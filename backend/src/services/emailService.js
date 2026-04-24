const nodemailer = require('nodemailer');

function createTransporter() {
  if (!process.env.SMTP_HOST) return null;
  const isLocal = ['localhost', '127.0.0.1'].includes(process.env.SMTP_HOST);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    ignoreTLS: isLocal,
    tls: { rejectUnauthorized: false },
    ...(isLocal ? {} : { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }),
  });
}

const FRONTEND = () => process.env.FRONTEND_URL || 'https://portal.vekpmt.ru';

function base(content) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F4F5;">
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:24px auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#18181B;padding:20px 32px;text-align:center;">
      <div style="color:#CC0033;font-size:22px;font-weight:bold;letter-spacing:1px;">Эффективная Техника</div>
      <div style="color:#A1A1AA;font-size:12px;margin-top:4px;">Сервисный портал · portal.vekpmt.ru</div>
    </div>
    <div style="padding:32px;">
      ${content}
    </div>
    <div style="background:#F4F4F5;padding:14px 32px;text-align:center;border-top:1px solid #E4E4E7;">
      <div style="color:#A1A1AA;font-size:11px;">Это автоматическое письмо — не отвечайте на него.</div>
      <div style="color:#A1A1AA;font-size:11px;margin-top:2px;">© 2026 Эффективная Техника · <a href="https://vekpmt.ru" style="color:#003399;text-decoration:none;">vekpmt.ru</a></div>
    </div>
  </div>
  </body></html>`;
}

function btn(text, url) {
  return `<a href="${url}" style="display:inline-block;background:#CC0033;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px;">${text}</a>`;
}

async function send(to, subject, html) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[EMAIL] ${subject} → ${to}`);
    return;
  }
  try {
    await transporter.sendMail({
      from: `"Эффективная Техника" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
  } catch (err) {
    console.error(`[EMAIL ERROR] ${subject} → ${to}: ${err.message}`);
  }
}

// ─── 1. Сброс пароля ────────────────────────────────────────────────────────
async function sendPasswordReset(toEmail, resetLink) {
  const html = base(`
    <h2 style="color:#18181B;margin:0 0 12px;">Восстановление пароля</h2>
    <p style="color:#52525B;">Вы запросили сброс пароля для Сервисного Портала.</p>
    <p style="color:#52525B;">Нажмите кнопку ниже, чтобы задать новый пароль. <strong>Ссылка действительна 1 час.</strong></p>
    ${btn('Сбросить пароль', resetLink)}
    <p style="color:#A1A1AA;font-size:12px;margin-top:20px;">Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.</p>
  `);
  await send(toEmail, 'Восстановление пароля — Эффективная Техника', html);
}

// ─── 2. Новая заявка на регистрацию → руководителям ─────────────────────────
async function sendRegistrationReceivedToStaff(directorEmail, data) {
  const html = base(`
    <h2 style="color:#18181B;margin:0 0 12px;">Новая заявка на регистрацию</h2>
    <p style="color:#52525B;">Поступила новая заявка на подключение к Сервисному порталу.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:7px 0;color:#71717A;width:45%;">Организация</td><td style="padding:7px 0;font-weight:600;">${data.company_name}</td></tr>
      <tr><td style="padding:7px 0;color:#71717A;">Контактное лицо</td><td style="padding:7px 0;">${data.contact_name}</td></tr>
      <tr><td style="padding:7px 0;color:#71717A;">Телефон</td><td style="padding:7px 0;">${data.contact_phone}</td></tr>
      <tr><td style="padding:7px 0;color:#71717A;">Email</td><td style="padding:7px 0;">${data.contact_email}</td></tr>
    </table>
    ${btn('Рассмотреть заявку', FRONTEND() + '/admin/registrations')}
  `);
  await send(directorEmail, `Новая заявка на регистрацию — ${data.company_name}`, html);
}

// ─── 3. Регистрация одобрена → клиенту ──────────────────────────────────────
async function sendRegistrationApproved(toEmail, data) {
  const html = base(`
    <h2 style="color:#16A34A;margin:0 0 12px;">✓ Регистрация одобрена</h2>
    <p style="color:#52525B;">Здравствуйте, <strong>${data.contact_name}</strong>!</p>
    <p style="color:#52525B;">Ваша заявка на регистрацию в Сервисном портале <strong>одобрена</strong>. Теперь вы можете войти в личный кабинет.</p>
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;">
      <div style="color:#71717A;margin-bottom:4px;">Email для входа:</div>
      <div style="font-weight:600;">${toEmail}</div>
    </div>
    ${btn('Войти в личный кабинет', FRONTEND())}
  `);
  await send(toEmail, 'Регистрация одобрена — Эффективная Техника', html);
}

// ─── 4. Регистрация отклонена → клиенту ─────────────────────────────────────
async function sendRegistrationRejected(toEmail, data) {
  const html = base(`
    <h2 style="color:#18181B;margin:0 0 12px;">Заявка на регистрацию отклонена</h2>
    <p style="color:#52525B;">Здравствуйте, <strong>${data.contact_name}</strong>!</p>
    <p style="color:#52525B;">К сожалению, ваша заявка на регистрацию в Сервисном портале была отклонена.</p>
    ${data.reason ? `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:8px;padding:14px;margin:16px 0;font-size:14px;"><div style="color:#71717A;margin-bottom:4px;">Причина:</div><div style="color:#52525B;">${data.reason}</div></div>` : ''}
    <p style="color:#52525B;font-size:14px;">По всем вопросам обращайтесь: <a href="mailto:info@vekpmt.ru" style="color:#003399;">info@vekpmt.ru</a></p>
  `);
  await send(toEmail, 'Заявка на регистрацию отклонена — Эффективная Техника', html);
}

// ─── 5. Новый сотрудник → сотруднику с данными входа ────────────────────────
async function sendStaffWelcome(toEmail, data) {
  const roleLabel = data.role === 'director' ? 'Руководитель' : data.role === 'manager' ? 'Менеджер' : 'Инженер';
  const html = base(`
    <h2 style="color:#18181B;margin:0 0 12px;">Добро пожаловать!</h2>
    <p style="color:#52525B;">Здравствуйте, <strong>${data.name}</strong>!</p>
    <p style="color:#52525B;">Для вас создан аккаунт в Сервисном портале «Эффективная Техника».</p>
    <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;">
      <div style="margin-bottom:8px;"><span style="color:#71717A;">Email:</span> <strong>${toEmail}</strong></div>
      <div style="margin-bottom:8px;"><span style="color:#71717A;">Пароль:</span> <strong>${data.password}</strong></div>
      <div><span style="color:#71717A;">Роль:</span> ${roleLabel}</div>
    </div>
    <p style="color:#EF4444;font-size:13px;margin-bottom:4px;">⚠ Рекомендуем сменить пароль после первого входа.</p>
    ${btn('Войти в портал', FRONTEND())}
  `);
  await send(toEmail, 'Доступ к Сервисному порталу — Эффективная Техника', html);
}

// ─── 6. Заявка создана → клиенту (подтверждение) ────────────────────────────
async function sendTicketCreated(toEmail, data) {
  const html = base(`
    <h2 style="color:#18181B;margin:0 0 12px;">Заявка #${data.ticket_id} принята</h2>
    <p style="color:#52525B;">Здравствуйте!</p>
    <p style="color:#52525B;">Ваша заявка принята и передана в работу. Мы уведомим вас о любых изменениях.</p>
    <div style="background:#F4F4F5;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;">
      <div style="margin-bottom:6px;"><span style="color:#71717A;">Номер заявки:</span> <strong>#${data.ticket_id}</strong></div>
      ${data.type_name ? `<div style="margin-bottom:6px;"><span style="color:#71717A;">Тип:</span> ${data.type_name}</div>` : ''}
      <div><span style="color:#71717A;">Описание:</span> ${(data.description || '').slice(0, 300)}</div>
    </div>
    ${btn('Открыть заявку', FRONTEND() + '/client/tickets')}
  `);
  await send(toEmail, `Заявка #${data.ticket_id} принята — Эффективная Техника`, html);
}

// ─── 7. Смена статуса заявки → клиенту ──────────────────────────────────────
async function sendTicketStatusChanged(toEmail, data) {
  const STATUS_MAP = {
    new: { label: 'Новая', color: '#6B7280' },
    in_progress: { label: 'В работе', color: '#2563EB' },
    waiting_parts: { label: 'Ожидание запчастей', color: '#D97706' },
    waiting_client: { label: 'Ожидание клиента', color: '#7C3AED' },
    done: { label: 'Выполнена', color: '#16A34A' },
    cancelled: { label: 'Отменена', color: '#DC2626' },
  };
  const s = STATUS_MAP[data.new_status] || { label: data.new_status, color: '#6B7280' };
  const html = base(`
    <h2 style="color:#18181B;margin:0 0 12px;">Статус заявки #${data.ticket_id} изменён</h2>
    <p style="color:#52525B;">Статус вашей заявки обновлён.</p>
    <div style="text-align:center;margin:20px 0;">
      <span style="display:inline-block;background:${s.color};color:#fff;padding:8px 24px;border-radius:20px;font-weight:600;font-size:15px;">${s.label}</span>
    </div>
    ${btn('Открыть заявку', FRONTEND() + '/client/tickets')}
  `);
  await send(toEmail, `Заявка #${data.ticket_id}: статус изменён на «${s.label}»`, html);
}

// ─── 8. Назначен инженер → сотруднику ───────────────────────────────────────
async function sendTicketAssigned(toEmail, data) {
  const html = base(`
    <h2 style="color:#18181B;margin:0 0 12px;">Вам назначена заявка #${data.ticket_id}</h2>
    <p style="color:#52525B;">Здравствуйте, <strong>${data.engineer_name}</strong>!</p>
    <p style="color:#52525B;">Вам назначена заявка от клиента <strong>${data.company_name}</strong>.</p>
    <div style="background:#F4F4F5;border-radius:8px;padding:16px;margin:16px 0;font-size:14px;">
      <div style="margin-bottom:6px;"><span style="color:#71717A;">Заявка:</span> <strong>#${data.ticket_id}</strong></div>
      <div><span style="color:#71717A;">Описание:</span> ${(data.description || '').slice(0, 300)}</div>
    </div>
    ${btn('Открыть заявку', FRONTEND() + '/admin/tickets/' + data.ticket_id)}
  `);
  await send(toEmail, `Вам назначена заявка #${data.ticket_id}`, html);
}

// ─── 9. Новое сообщение от сотрудника → клиенту ─────────────────────────────
async function sendNewMessageToClient(toEmail, data) {
  const html = base(`
    <h2 style="color:#18181B;margin:0 0 12px;">Новое сообщение по заявке #${data.ticket_id}</h2>
    <p style="color:#52525B;">По вашей заявке получен ответ от специалиста.</p>
    <div style="background:#F4F4F5;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #003399;font-size:14px;">
      <div style="color:#71717A;font-size:12px;margin-bottom:6px;">${data.sender_name}</div>
      <div style="color:#18181B;">${(data.content || '').slice(0, 400)}</div>
    </div>
    ${btn('Ответить', FRONTEND() + '/client/tickets/' + data.ticket_id)}
  `);
  await send(toEmail, `Новое сообщение по заявке #${data.ticket_id}`, html);
}

// ─── 10. Новое сообщение от клиента → сотруднику ────────────────────────────
async function sendNewMessageToStaff(toEmail, data) {
  const html = base(`
    <h2 style="color:#18181B;margin:0 0 12px;">Сообщение от клиента</h2>
    <p style="color:#52525B;">По заявке <strong>#${data.ticket_id}</strong> от <strong>${data.company_name}</strong> получено новое сообщение.</p>
    <div style="background:#F4F4F5;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #CC0033;font-size:14px;">
      <div style="color:#18181B;">${(data.content || '').slice(0, 400)}</div>
    </div>
    ${btn('Открыть заявку', FRONTEND() + '/admin/tickets/' + data.ticket_id)}
  `);
  await send(toEmail, `Сообщение от клиента по заявке #${data.ticket_id}`, html);
}

module.exports = {
  sendPasswordReset,
  sendRegistrationReceivedToStaff,
  sendRegistrationApproved,
  sendRegistrationRejected,
  sendStaffWelcome,
  sendTicketCreated,
  sendTicketStatusChanged,
  sendTicketAssigned,
  sendNewMessageToClient,
  sendNewMessageToStaff,
};
