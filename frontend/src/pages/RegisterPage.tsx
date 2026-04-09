import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ReCAPTCHA from 'react-google-recaptcha'
import api from '../api/client'
import toast from 'react-hot-toast'

const steps = ['Компания', 'Контакт', 'Пароль']

export default function RegisterPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const recaptchaRef = useRef<ReCAPTCHA>(null)

  const [form, setForm] = useState({
    company_name: '', inn: '', legal_address: '',
    contact_name: '', contact_phone: '', contact_email: '',
    password: '', password2: '', agree: false,
  })

  const set = (field: string, value: string | boolean) =>
    setForm(f => ({ ...f, [field]: value }))

  const nextStep = () => {
    if (step === 1) {
      if (!form.company_name) { toast.error('Введите название организации'); return }
    }
    if (step === 2) {
      if (!form.contact_name || !form.contact_phone || !form.contact_email) {
        toast.error('Заполните все обязательные поля'); return
      }
    }
    setStep(s => s + 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.agree) { toast.error('Примите пользовательское соглашение'); return }
    if (form.password.length < 8) { toast.error('Пароль минимум 8 символов'); return }
    if (form.password !== form.password2) { toast.error('Пароли не совпадают'); return }

    const recaptchaToken = recaptchaRef.current?.getValue()
    if (!recaptchaToken) { toast.error('Пройдите проверку reCAPTCHA'); return }

    setLoading(true)
    try {
      await api.post('/registrations', {
        company_name: form.company_name,
        inn: form.inn,
        legal_address: form.legal_address,
        contact_name: form.contact_name,
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
        password: form.password,
        recaptcha_token: recaptchaToken,
      })
      toast.success('Заявка отправлена! Ожидайте подтверждения.')
      navigate('/login')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background: 'linear-gradient(135deg, #18181B 0%, #27272A 50%, #003399 100%)'}}>
      <div className="bg-white rounded-xl border border-[#E4E4E7] shadow-sm w-full max-w-[480px] p-8">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo-icon.png" alt="" className="h-12 w-auto mb-3" onError={e => (e.currentTarget.style.display='none')} />
          <h1 className="text-xl font-bold text-[#18181B]">Регистрация</h1>
          <p className="text-sm text-[#71717A] mt-1">Создайте личный кабинет</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((label, i) => {
            const num = i + 1
            const done = step > num
            const active = step === num
            return (
              <div key={i} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-0.5 ${done || active ? 'bg-[#CC0033]' : 'bg-[#E4E4E7]'}`} />}
                <div className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                    ${done ? 'bg-green-500 border-green-500 text-white' : active ? 'bg-[#CC0033] border-[#CC0033] text-white' : 'border-[#E4E4E7] text-[#A1A1AA]'}`}>
                    {done ? '✓' : num}
                  </div>
                  <span className={`text-xs font-semibold ${active ? 'text-[#18181B]' : done ? 'text-green-600' : 'text-[#A1A1AA]'}`}>{label}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div>
            <Field label="Название организации" required>
              <input className="form-control" placeholder="ООО «Название»" value={form.company_name} onChange={e => set('company_name', e.target.value)} />
            </Field>
            <Field label="ИНН">
              <input className="form-control" placeholder="1234567890" maxLength={12} value={form.inn} onChange={e => set('inn', e.target.value)} />
            </Field>
            <Field label="Юридический адрес">
              <input className="form-control" placeholder="г. Москва, ул. Примерная, д. 1" value={form.legal_address} onChange={e => set('legal_address', e.target.value)} />
            </Field>
            <button onClick={nextStep} className="btn btn-primary w-full justify-center py-3 mt-2">Далее →</button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <Field label="ФИО" required>
              <input className="form-control" placeholder="Иванов Алексей Викторович" value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Телефон" required>
                <input className="form-control" placeholder="+7 (999) 123-45-67" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
              </Field>
              <Field label="Email" required>
                <input className="form-control" type="email" placeholder="ivanov@company.ru" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} />
              </Field>
            </div>
            <div className="flex gap-3 mt-2">
              <button onClick={() => setStep(1)} className="btn btn-secondary flex-1 justify-center py-3">← Назад</button>
              <button onClick={nextStep} className="btn btn-primary flex-[2] justify-center py-3">Далее →</button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <form onSubmit={handleSubmit}>
            <Field label="Пароль" required>
              <input className="form-control" type="password" placeholder="Минимум 8 символов" value={form.password} onChange={e => set('password', e.target.value)} />
              <PasswordStrength password={form.password} />
            </Field>
            <Field label="Повторите пароль" required>
              <input className="form-control" type="password" placeholder="Введите пароль ещё раз" value={form.password2} onChange={e => set('password2', e.target.value)} />
            </Field>

            {/* Agreement */}
            <div className="flex items-start gap-3 my-5 p-3 bg-[#FAFAFA] rounded border border-[#E4E4E7]">
              <input
                type="checkbox"
                id="agree"
                className="mt-0.5 accent-[#CC0033] cursor-pointer"
                checked={form.agree}
                onChange={e => set('agree', e.target.checked)}
                required
              />
              <label htmlFor="agree" className="text-xs text-[#52525B] leading-relaxed cursor-pointer">
                Я принимаю <a href="#" className="text-[#003399] hover:underline font-medium">условия пользовательского соглашения</a> и даю согласие на <a href="#" className="text-[#003399] hover:underline font-medium">обработку персональных данных</a>
              </label>
            </div>

            <div className="mb-4">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI'}
                theme="light"
              />
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(2)} className="btn btn-secondary flex-1 justify-center py-3">← Назад</button>
              <button type="submit" disabled={loading || !form.agree} className="btn btn-primary flex-[2] justify-center py-3 disabled:opacity-60">
                {loading ? 'Отправка...' : 'Зарегистрироваться'}
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-[#E4E4E7] text-center">
          <span className="text-sm text-[#71717A]">Уже есть личный кабинет? </span>
          <Link to="/login" className="text-sm text-[#003399] font-semibold hover:underline">Войти</Link>
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-[#18181B] mb-1.5">
        {label} {required && <span className="text-[#CC0033]">*</span>}
      </label>
      {children}
    </div>
  )
}

function PasswordStrength({ password }: { password: string }) {
  let strength = 0
  if (password.length >= 8) strength++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
  if (/\d/.test(password)) strength++
  if (/[^a-zA-Z0-9]/.test(password)) strength++
  const colors = ['', '#DC2626', '#EA580C', '#CA8A04', '#16A34A']
  const labels = ['', 'Слабый', 'Средний', 'Хороший', 'Надёжный']
  return password ? (
    <div className="mt-1.5">
      <div className="flex gap-1 mb-1">
        {[1,2,3,4].map(i => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all"
            style={{ background: i <= strength ? colors[strength] : '#E4E4E7' }} />
        ))}
      </div>
      <div className="text-xs" style={{ color: colors[strength] }}>{labels[strength]}</div>
    </div>
  ) : null
}
