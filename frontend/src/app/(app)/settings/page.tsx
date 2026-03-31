'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Camera, Mic, Bell, Eye, Zap, Save, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '@/lib/api';
import type { UserSettings, MediaDeviceOption } from '@/types';
import { useAuthStore } from '@/store/authStore';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authAPI.getSettings()
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));

    // Enumerate devices
    navigator.mediaDevices.enumerateDevices().then(devices => {
      setCameras(devices.filter(d => d.kind === 'videoinput'));
      setMics(devices.filter(d => d.kind === 'audioinput'));
    }).catch(() => {
      // Request permissions first
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
          stream.getTracks().forEach(t => t.stop());
          return navigator.mediaDevices.enumerateDevices();
        })
        .then(devices => {
          setCameras(devices.filter(d => d.kind === 'videoinput'));
          setMics(devices.filter(d => d.kind === 'audioinput'));
        })
        .catch(console.error);
    });
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await authAPI.updateSettings(settings);
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const update = (key: keyof UserSettings, value: any) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev);
  };

  if (loading || !settings) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-4 animate-pulse">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-panel rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-text-primary">Settings</h1>
        <p className="text-text-secondary text-sm mt-1">Customize your coaching experience</p>
      </div>

      <div className="space-y-5">
        {/* Profile */}
        <Section icon={<Zap size={16} className="text-cyan" />} title="Account">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-text-tertiary mb-2">Name</label>
              <div className="input-field opacity-60 cursor-not-allowed">{user?.name}</div>
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-2">Email</label>
              <div className="input-field opacity-60 cursor-not-allowed">{user?.email}</div>
            </div>
          </div>
        </Section>

        {/* Camera */}
        <Section icon={<Camera size={16} className="text-violet-bright" />} title="Camera">
          <div>
            <label className="block text-xs text-text-tertiary mb-2">Default Camera</label>
            <select
              value={settings.camera_device_id || ''}
              onChange={e => update('camera_device_id', e.target.value || undefined)}
              className="input-field"
            >
              <option value="">System Default</option>
              {cameras.map(c => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label || `Camera ${c.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
            {cameras.length === 0 && (
              <p className="text-xs text-text-tertiary mt-2">
                Grant camera permissions to see available devices
              </p>
            )}
          </div>
        </Section>

        {/* Microphone */}
        <Section icon={<Mic size={16} className="text-emerald" />} title="Microphone">
          <div>
            <label className="block text-xs text-text-tertiary mb-2">Default Microphone</label>
            <select
              value={settings.microphone_device_id || ''}
              onChange={e => update('microphone_device_id', e.target.value || undefined)}
              className="input-field"
            >
              <option value="">System Default</option>
              {mics.map(m => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label || `Microphone ${m.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
        </Section>

        {/* Coaching */}
        <Section icon={<Eye size={16} className="text-amber" />} title="Coaching Preferences">
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-text-tertiary mb-2">Coaching Sensitivity</label>
              <div className="grid grid-cols-3 gap-2">
                {(['low', 'medium', 'high'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => update('coaching_sensitivity', s)}
                    className={`py-2.5 rounded-xl text-sm font-medium capitalize transition-all border ${
                      settings.coaching_sensitivity === s
                        ? 'bg-cyan/10 border-cyan/30 text-cyan'
                        : 'border-border text-text-tertiary hover:border-border/80 hover:text-text-secondary'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {[
              { key: 'show_live_transcript', label: 'Show live transcript during session' },
              { key: 'show_confidence_meter', label: 'Show confidence meter overlay' },
              { key: 'auto_start_recording', label: 'Auto-start when session begins' },
              { key: 'notification_feedback', label: 'Show real-time coaching notifications' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-1">
                <span className="text-sm text-text-secondary">{label}</span>
                <Toggle
                  enabled={settings[key as keyof UserSettings] as boolean}
                  onChange={v => update(key as keyof UserSettings, v)}
                />
              </div>
            ))}
          </div>
        </Section>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon, title, children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-6"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-xl bg-panel flex items-center justify-center border border-border">
          {icon}
        </div>
        <h2 className="font-display font-semibold text-text-primary">{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-cyan' : 'bg-muted'}`}
    >
      <div
        className={`absolute top-1 w-4 h-4 rounded-full bg-void transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}
