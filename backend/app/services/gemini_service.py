"""
Gemini AI service for real-time speech analysis, vision analysis,
and coaching feedback generation.
"""
import asyncio
import base64
import json
import re
import time
from typing import AsyncGenerator, Dict, List, Optional, Tuple

import google.generativeai as genai

from app.core.config import settings
from app.core.logging import get_logger
from app.models.schemas import (
    FeedbackItem, FeedbackSeverity, FeedbackType,
    MetricSnapshot, TranscriptSegment,
)

logger = get_logger(__name__)

# Configure Gemini
genai.configure(api_key=settings.gemini_api_key)

FILLER_WORDS = {
    "um", "uh", "er", "ah", "like", "you know", "basically",
    "literally", "actually", "so", "right", "okay", "well",
    "kind of", "sort of", "i mean", "you see",
}

SPEECH_ANALYSIS_PROMPT = """You are an expert communication coach analyzing a speech segment.
Analyze the following transcript and provide coaching feedback.

Transcript: {transcript}
Duration (seconds): {duration_s}

Respond ONLY with a JSON object (no markdown, no preamble):
{{
  "filler_words_found": ["list", "of", "filler", "words", "detected"],
  "word_count": <integer>,
  "pace_wpm": <float - words per minute>,
  "clarity_score": <float 0-100>,
  "confidence_indicators": <float 0-100>,
  "coaching_feedback": [
    {{
      "type": "<pace|filler|confidence|clarity|positive>",
      "severity": "<info|warning|success>",
      "message": "<short actionable message under 10 words>",
      "detail": "<optional one sentence detail>"
    }}
  ]
}}"""

VISION_ANALYSIS_PROMPT = """You are an expert body language and presentation coach.
Analyze this video frame for communication cues.

Respond ONLY with a JSON object (no markdown, no preamble):
{{
  "eye_contact_score": <float 0-100, where 100 = direct eye contact with camera>,
  "posture_score": <float 0-100, where 100 = perfect upright posture>,
  "confidence_score": <float 0-100 based on body language>,
  "face_visible": <boolean>,
  "coaching_feedback": [
    {{
      "type": "<eye_contact|posture|confidence|positive>",
      "severity": "<info|warning|success>",
      "message": "<short actionable message under 10 words>"
    }}
  ]
}}"""

COACHING_SYSTEM_PROMPT = """You are an expert real-time communication coach embedded in a practice platform.
Give concise, actionable feedback. Keep messages under 8 words. Be encouraging but direct.
Focus on the most impactful improvement."""


class GeminiService:
    def __init__(self):
        self._model = None
        self._vision_model = None
        self._last_feedback_time: Dict[str, float] = {}
        self._feedback_cooldown: Dict[str, float] = {
            FeedbackType.PACE: 8.0,
            FeedbackType.FILLER: 5.0,
            FeedbackType.EYE_CONTACT: 6.0,
            FeedbackType.POSTURE: 10.0,
            FeedbackType.CONFIDENCE: 8.0,
        }

    def _get_model(self) -> genai.GenerativeModel:
        if not self._model:
            self._model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=512,
                    response_mime_type="application/json",
                ),
            )
        return self._model

    def _get_vision_model(self) -> genai.GenerativeModel:
        if not self._vision_model:
            self._vision_model = genai.GenerativeModel(
                model_name="gemini-1.5-flash",
                generation_config=genai.GenerationConfig(
                    temperature=0.1,
                    max_output_tokens=512,
                    response_mime_type="application/json",
                ),
            )
        return self._vision_model

    async def analyze_speech(
        self,
        transcript: str,
        duration_s: float,
        timestamp_ms: int,
    ) -> Tuple[TranscriptSegment, List[FeedbackItem]]:
        """Analyze a transcript segment and return metrics + feedback."""
        if not transcript.strip():
            return self._empty_transcript(timestamp_ms, int(duration_s * 1000)), []

        # Quick local filler word detection (fast path)
        lower_text = transcript.lower()
        local_fillers = [fw for fw in FILLER_WORDS if f" {fw} " in f" {lower_text} "]
        word_count = len(transcript.split())
        pace_wpm = (word_count / duration_s * 60) if duration_s > 0 else 0

        try:
            prompt = SPEECH_ANALYSIS_PROMPT.format(
                transcript=transcript,
                duration_s=round(duration_s, 1),
            )
            model = self._get_model()
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, lambda: model.generate_content(prompt)
            )
            result = json.loads(response.text)

            filler_words = result.get("filler_words_found", local_fillers)
            ai_wc = result.get("word_count", word_count)
            ai_pace = result.get("pace_wpm", pace_wpm)
            clarity = result.get("clarity_score", 75.0)
            confidence = result.get("confidence_indicators", 70.0)

            segment = TranscriptSegment(
                timestamp_ms=timestamp_ms,
                duration_ms=int(duration_s * 1000),
                text=transcript,
                filler_words=filler_words,
                word_count=ai_wc,
                confidence=min(1.0, confidence / 100),
            )

            feedbacks = []
            now = time.time()
            for fb_data in result.get("coaching_feedback", []):
                fb_type_str = fb_data.get("type", "confidence")
                try:
                    fb_type = FeedbackType(fb_type_str)
                except ValueError:
                    fb_type = FeedbackType.CONFIDENCE

                # Rate-limit per feedback type
                cooldown = self._feedback_cooldown.get(fb_type, 5.0)
                last = self._last_feedback_time.get(fb_type, 0)
                if now - last < cooldown:
                    continue
                self._last_feedback_time[fb_type] = now

                try:
                    severity = FeedbackSeverity(fb_data.get("severity", "info"))
                except ValueError:
                    severity = FeedbackSeverity.INFO

                feedbacks.append(FeedbackItem(
                    timestamp_ms=timestamp_ms,
                    feedback_type=fb_type,
                    severity=severity,
                    message=fb_data.get("message", ""),
                    detail=fb_data.get("detail"),
                    score=confidence,
                ))

            return segment, feedbacks

        except Exception as e:
            logger.warning("Gemini speech analysis failed, using local analysis", error=str(e))
            segment = TranscriptSegment(
                timestamp_ms=timestamp_ms,
                duration_ms=int(duration_s * 1000),
                text=transcript,
                filler_words=local_fillers,
                word_count=word_count,
                confidence=0.85,
            )
            feedbacks = self._local_speech_feedback(
                local_fillers, pace_wpm, timestamp_ms
            )
            return segment, feedbacks

    async def analyze_vision(
        self,
        frame_b64: str,
        timestamp_ms: int,
    ) -> Tuple[Dict, List[FeedbackItem]]:
        """Analyze a video frame for body language cues."""
        try:
            image_data = genai.protos.Blob(
                mime_type="image/jpeg",
                data=base64.b64decode(frame_b64),
            )
            model = self._get_vision_model()
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: model.generate_content([VISION_ANALYSIS_PROMPT, image_data]),
            )
            result = json.loads(response.text)

            eye_contact = float(result.get("eye_contact_score", 70))
            posture = float(result.get("posture_score", 70))
            confidence = float(result.get("confidence_score", 70))
            face_visible = result.get("face_visible", True)

            feedbacks = []
            now = time.time()
            for fb_data in result.get("coaching_feedback", []):
                fb_type_str = fb_data.get("type", "eye_contact")
                try:
                    fb_type = FeedbackType(fb_type_str)
                except ValueError:
                    fb_type = FeedbackType.EYE_CONTACT

                cooldown = self._feedback_cooldown.get(fb_type, 6.0)
                last = self._last_feedback_time.get(f"vision_{fb_type}", 0)
                if now - last < cooldown:
                    continue
                self._last_feedback_time[f"vision_{fb_type}"] = now

                try:
                    severity = FeedbackSeverity(fb_data.get("severity", "info"))
                except ValueError:
                    severity = FeedbackSeverity.INFO

                feedbacks.append(FeedbackItem(
                    timestamp_ms=timestamp_ms,
                    feedback_type=fb_type,
                    severity=severity,
                    message=fb_data.get("message", ""),
                    score=eye_contact,
                ))

            return {
                "eye_contact_pct": eye_contact,
                "posture_score": posture,
                "confidence_score": confidence,
                "face_visible": face_visible,
            }, feedbacks

        except Exception as e:
            logger.warning("Gemini vision analysis failed", error=str(e))
            return {
                "eye_contact_pct": 70.0,
                "posture_score": 70.0,
                "confidence_score": 70.0,
                "face_visible": True,
            }, []

    async def generate_session_summary(
        self,
        metrics: List[MetricSnapshot],
        transcript_text: str,
        duration_seconds: int,
    ) -> dict:
        """Generate an overall session summary with coaching insights."""
        if not metrics:
            return self._empty_summary(duration_seconds)

        avg_conf = sum(m.confidence_score for m in metrics) / len(metrics)
        avg_pace = sum(m.speaking_pace_wpm for m in metrics) / len(metrics)
        avg_eye = sum(m.eye_contact_pct for m in metrics) / len(metrics)
        avg_posture = sum(m.posture_score for m in metrics) / len(metrics)
        total_fillers = sum(m.filler_word_count for m in metrics)
        avg_clarity = sum(m.clarity_score for m in metrics) / len(metrics)
        overall = (avg_conf * 0.3 + avg_eye * 0.25 + avg_posture * 0.2 + avg_clarity * 0.25)

        prompt = f"""Generate a coaching summary for this communication session.
Duration: {duration_seconds}s
Avg confidence: {avg_conf:.1f}/100
Avg pace: {avg_pace:.1f} WPM  
Avg eye contact: {avg_eye:.1f}%
Avg posture: {avg_posture:.1f}/100
Total filler words: {total_fillers}
Overall score: {overall:.1f}/100
Transcript excerpt: {transcript_text[:500]}

Respond with JSON only:
{{
  "top_issues": ["issue1", "issue2", "issue3"],
  "strengths": ["strength1", "strength2"],
  "summary_text": "2-3 sentence coaching summary"
}}"""

        try:
            model = self._get_model()
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(None, lambda: model.generate_content(prompt))
            ai_data = json.loads(response.text)
        except Exception as e:
            logger.warning("Summary generation failed", error=str(e))
            ai_data = {
                "top_issues": self._derive_issues(avg_conf, avg_pace, avg_eye, avg_posture),
                "strengths": ["Completed the session", "Showed consistency"],
            }

        return {
            "avg_confidence": round(avg_conf, 1),
            "avg_pace_wpm": round(avg_pace, 1),
            "avg_eye_contact_pct": round(avg_eye, 1),
            "avg_posture_score": round(avg_posture, 1),
            "total_filler_words": total_fillers,
            "total_words": sum(len(t.split()) for t in transcript_text.split(".") if t),
            "top_issues": ai_data.get("top_issues", []),
            "strengths": ai_data.get("strengths", []),
            "overall_score": round(overall, 1),
            "duration_seconds": duration_seconds,
        }

    def _empty_transcript(self, timestamp_ms: int, duration_ms: int) -> TranscriptSegment:
        return TranscriptSegment(
            timestamp_ms=timestamp_ms,
            duration_ms=duration_ms,
            text="",
            word_count=0,
        )

    def _empty_summary(self, duration_seconds: int) -> dict:
        return {
            "avg_confidence": 0,
            "avg_pace_wpm": 0,
            "avg_eye_contact_pct": 0,
            "avg_posture_score": 0,
            "total_filler_words": 0,
            "total_words": 0,
            "top_issues": [],
            "strengths": [],
            "overall_score": 0,
            "duration_seconds": duration_seconds,
        }

    def _local_speech_feedback(
        self, fillers: List[str], pace_wpm: float, timestamp_ms: int
    ) -> List[FeedbackItem]:
        feedbacks = []
        now = time.time()

        if len(fillers) >= 3:
            key = FeedbackType.FILLER
            if now - self._last_feedback_time.get(key, 0) >= self._feedback_cooldown[key]:
                self._last_feedback_time[key] = now
                feedbacks.append(FeedbackItem(
                    timestamp_ms=timestamp_ms,
                    feedback_type=key,
                    severity=FeedbackSeverity.WARNING,
                    message=f"Reduce filler words",
                    detail=f"Detected: {', '.join(fillers[:3])}",
                ))

        if pace_wpm > 160:
            key = FeedbackType.PACE
            if now - self._last_feedback_time.get(key, 0) >= self._feedback_cooldown[key]:
                self._last_feedback_time[key] = now
                feedbacks.append(FeedbackItem(
                    timestamp_ms=timestamp_ms,
                    feedback_type=key,
                    severity=FeedbackSeverity.WARNING,
                    message="Slow down a little",
                    detail=f"Currently at {pace_wpm:.0f} WPM",
                ))
        elif pace_wpm < 80 and pace_wpm > 0:
            key = FeedbackType.PACE
            if now - self._last_feedback_time.get(key, 0) >= self._feedback_cooldown[key]:
                self._last_feedback_time[key] = now
                feedbacks.append(FeedbackItem(
                    timestamp_ms=timestamp_ms,
                    feedback_type=key,
                    severity=FeedbackSeverity.INFO,
                    message="Pick up the pace slightly",
                ))

        return feedbacks

    def _derive_issues(self, conf, pace, eye, posture) -> List[str]:
        issues = []
        if conf < 60:
            issues.append("Low confidence indicators in speech")
        if pace > 160:
            issues.append("Speaking pace too fast")
        elif pace < 80:
            issues.append("Speaking pace too slow")
        if eye < 60:
            issues.append("Maintain eye contact with camera")
        if posture < 60:
            issues.append("Improve posture and body positioning")
        return issues[:3] or ["Continue consistent practice"]


# Singleton
_gemini_service: Optional[GeminiService] = None


def get_gemini_service() -> GeminiService:
    global _gemini_service
    if _gemini_service is None:
        _gemini_service = GeminiService()
    return _gemini_service
