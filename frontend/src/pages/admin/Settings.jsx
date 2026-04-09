import { useState } from 'react'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

export default function AdminSettings() {
  const [smsDefaults, setSmsDefaults] = useState({ default_sms_limit: 100, default_storage_mb: 1024, default_ram_mb: 512 })
  const toast = useToast()

  return (
    <div className="p-6">
      <h1 className="font-display font-bold text-2xl mb-6">Tənzimləmələr</h1>

      <div className="max-w-lg space-y-6">
        <Card className="p-6">
          <h2 className="font-display font-bold text-base mb-4">📱 SMS Defolt Limitlər</h2>
          <div className="space-y-4">
            {[
              { key: 'default_sms_limit', label: 'Aylıq SMS Limiti', unit: 'SMS' },
              { key: 'default_storage_mb', label: 'Storage Limiti', unit: 'MB' },
              { key: 'default_ram_mb', label: 'RAM Limiti', unit: 'MB' },
            ].map(({ key, label, unit }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label} ({unit})</label>
                <input type="number" className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                  value={smsDefaults[key]} onChange={e => setSmsDefaults(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
            <Button onClick={() => toast('Yadda saxlandı!')} className="w-full justify-center">Yadda Saxla</Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-display font-bold text-base mb-4">🔐 Sistem Məlumatları</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-indigo-500/10">
              <span className="text-gray-400">Versiya</span>
              <span className="text-white font-semibold">v2.0.0</span>
            </div>
            <div className="flex justify-between py-2 border-b border-indigo-500/10">
              <span className="text-gray-400">Database</span>
              <span className="text-emerald-400 font-semibold">✓ Qoşulub</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-400">SMS Servisi</span>
              <span className="text-emerald-400 font-semibold">✓ Aktiv</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
