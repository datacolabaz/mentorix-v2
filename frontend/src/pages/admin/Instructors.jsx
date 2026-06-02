import { useEffect, useState } from "react"
import api from "../../lib/api"
import Card from "../../components/common/Card"
import Button from "../../components/common/Button"
import Modal from "../../components/common/Modal"
import { useToast } from "../../components/common/Toast"

export default function AdminInstructors() {
  const [instructors, setInstructors] = useState([])
  const [addModal, setAddModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", subject: "", billing_type: "8_lessons" })
  const [editForm, setEditForm] = useState({ full_name: "", email: "", phone: "", subject: "", new_password: "" })
  const [planBusy, setPlanBusy] = useState({})
  const toast = useToast()

  const load = () => api.get("/admin/instructors").then(d => setInstructors(d.instructors || []))
  useEffect(() => { load() }, [])

  const addInstructor = async () => {
    if (!form.full_name || !form.phone) { toast("Ad ve telefon teleb olunur", "error"); return }
    setLoading(true)
    try {
      const rnd = Math.random().toString(36).slice(-10)
      const res = await api.post("/auth/register", { ...form, role: "instructor", password: rnd })
      if (res?.email_verification_sent) {
        toast("Muellim elave edildi. Email tesdiq linki gonderildi.")
      } else if (res?.email_verification_error) {
        toast("Muellim elave edildi, amma email gonderile bilmedi: " + res.email_verification_error, "error")
      } else {
        toast("Muellim elave edildi")
      }
      setAddModal(false)
      setForm({ full_name: "", email: "", phone: "", subject: "", billing_type: "8_lessons" })
      load()
    } catch (err) { toast(err.message || "Xeta", "error") }
    finally { setLoading(false) }
  }

  const openEdit = (i) => {
    setSelected(i)
    setEditForm({
      full_name: i.full_name,
      email: i.email || "",
      phone: i.phone || "",
      subject: i.subject || "",
      new_password: "",
    })
    setEditModal(true)
  }

  const saveEdit = async () => {
    try {
      const body = {
        full_name: editForm.full_name,
        phone: editForm.phone,
        subject: editForm.subject,
        email: editForm.email,
      }
      if (editForm.new_password?.trim()) body.new_password = editForm.new_password.trim()
      await api.patch("/admin/instructors/" + selected.id + "/profile", body)
      toast(editForm.new_password?.trim() ? "Email/şifrə yeniləndi — müəllim indi email ilə girə bilər" : "Məlumatlar yeniləndi")
      setEditModal(false)
      load()
    } catch (err) { toast(err.message || "Xeta", "error") }
  }

  const setPlan = async (instructorId, plan) => {
    setPlanBusy((p) => ({ ...p, [instructorId]: true }))
    try {
      await api.patch("/admin/instructors/" + instructorId + "/plan", { plan })
      toast("Paket yeniləndi")
      load()
    } catch (e) {
      toast(e?.message || "Xəta", "error")
    } finally {
      setPlanBusy((p) => ({ ...p, [instructorId]: false }))
    }
  }

  const toggle = async (i) => {
    await api.patch("/admin/instructors/" + i.id + "/toggle", { is_active: !i.is_active })
    toast(i.is_active ? "Deaktiv edildi" : "Aktiv edildi")
    load()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl">Muellimler</h1>
        <Button onClick={() => setAddModal(true)}>+ Muellim Elave Et</Button>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-indigo-500/20 text-gray-400 text-xs uppercase">
              {["Ad", "Email", "Fenn", "Telefon", "Plan", "Telebe", "SMS", "Status", "Emeliyyat"].map(h => (
                <th key={h} className="py-3 px-4 text-left font-semibold tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {instructors.map(i => (
              <tr key={i.id} className="border-b border-indigo-500/10 hover:bg-indigo-500/5">
                <td className="py-3 px-4"><div className="font-semibold text-white">{i.full_name}</div></td>
                <td className="py-3 px-4 text-gray-300 text-xs">{i.email || "-"}</td>
                <td className="py-3 px-4 text-gray-300">{i.subject || "-"}</td>
                <td className="py-3 px-4 text-gray-300 text-xs">{i.phone || "-"}</td>
                <td className="py-3 px-4">
                  <select
                    className="bg-[#13112e] border border-indigo-500/20 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:border-blue-500 disabled:opacity-50"
                    value={(i.plan || "basic").toLowerCase()}
                    disabled={!!planBusy[i.id]}
                    onChange={(e) => void setPlan(i.id, e.target.value)}
                  >
                    <option value="basic">SADƏ</option>
                    <option value="pro">PRO</option>
                    <option value="growth">GROWTH</option>
                    <option value="premium">PREMIUM</option>
                  </select>
                </td>
                <td className="py-3 px-4 text-gray-300">{i.student_count || 0}</td>
                <td className="py-3 px-4 text-xs">
                  <span className="text-blue-400 font-semibold">{i.sms_used_monthly || 0}</span>
                  <span className="text-gray-500">/{i.sms_limit_monthly ?? "∞"}</span>
                </td>
                <td className="py-3 px-4">
                  <span className={"px-2 py-1 rounded-lg text-xs font-semibold " + (i.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
                    {i.is_active ? "Aktiv" : "Deaktiv"}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(i)}>Redakte</Button>
                    <Button size="sm" variant={i.is_active ? "danger" : "ghost"} onClick={() => toggle(i)}>
                      {i.is_active ? "Deaktiv" : "Aktiv"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!instructors.length && <div className="text-center py-12 text-gray-500">Muellim tapilmadi</div>}
      </Card>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Yeni Muellim">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ad Soyad</label>
            <input placeholder="Ali Huseynov" className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email</label>
            <input type="email" placeholder="muellim@gmail.com" className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            <p className="text-[10px] text-gray-500 mt-1">Tesdiq linki ve 6 reqemli kod bu emaile gonderilir.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Telefon</label>
            <input placeholder="+994501234567" className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fenn</label>
            <input placeholder="Riyaziyyat" className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Billing Novu</label>
            <select className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={form.billing_type} onChange={e => setForm(p => ({ ...p, billing_type: e.target.value }))}>
              <option value="8_lessons">8 Ders</option>
              <option value="12_lessons">12 Ders</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={addInstructor} loading={loading} className="flex-1 justify-center">Elave Et</Button>
            <Button variant="secondary" onClick={() => setAddModal(false)} className="flex-1 justify-center">Legv et</Button>
          </div>
        </div>
      </Modal>

      <Modal open={editModal} onClose={() => setEditModal(false)} title="Muellimi Redakte Et">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ad Soyad</label>
            <input className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={editForm.full_name} onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email (giriş üçün)</label>
            <input
              type="email"
              placeholder="muellim@gmail.com"
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={editForm.email}
              onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Boşdursa təyin edin — müəllim login səhifəsində Email + şifrə ilə daxil olacaq.
              {selected?.has_google ? " (Google hesabı da var)" : ""}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Yeni şifrə (istəyə görə)</label>
            <input
              type="password"
              placeholder="ən azı 8 simvol"
              autoComplete="new-password"
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={editForm.new_password}
              onChange={(e) => setEditForm((p) => ({ ...p, new_password: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Telefon (OTP giriş — istəyə görə)</label>
            <input placeholder="+994501234567" className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fenn</label>
            <input className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={editForm.subject} onChange={e => setEditForm(p => ({ ...p, subject: e.target.value }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={saveEdit} className="flex-1 justify-center">Yadda Saxla</Button>
            <Button variant="secondary" onClick={() => setEditModal(false)} className="flex-1 justify-center">Legv et</Button>
          </div>
          <div className="pt-2 border-t border-red-500/20 mt-2">
            <Button variant="danger" className="w-full justify-center" onClick={async () => {
              if (!window.confirm(selected.full_name + " silinsin?")) return
              try {
                await api.patch("/admin/instructors/" + selected.id + "/toggle", { is_active: false })
                await api.delete("/admin/instructors/" + selected.id)
                setEditModal(false)
                load()
              } catch(e) {
                toast("Xeta: " + e.message, "error")
              }
            }}>Muellimi Sil</Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}