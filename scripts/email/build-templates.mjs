// Generates the Supabase Auth email templates (supabase/templates/*.html) in
// three languages. Each template branches on the account language stored in
// user metadata (.Data.locale). Run: node scripts/email/build-templates.mjs
import { writeFileSync } from 'node:fs';

const LOCALE = '{{ if .Data.locale }}{{ .Data.locale }}{{ else }}en{{ end }}';
const link = (type) =>
  `{{ .SiteURL }}/${LOCALE}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=${type}`;

const copy = {
  confirmation: {
    link: link('email'),
    ru: {
      subject: 'Подтвердите почту — Veritas Tasks',
      title: 'Добро пожаловать на борт',
      text: 'Остался один шаг: подтвердите, что это ваша почта, и настроим корабль.',
      button: 'Подтвердить почту',
      note: 'Ссылка действует один час. Если вы не регистрировались в Veritas Tasks, просто проигнорируйте письмо.',
    },
    en: {
      subject: 'Confirm your email — Veritas Tasks',
      title: 'Welcome aboard',
      text: 'One step left: confirm this is your email and we will set up your ship.',
      button: 'Confirm email',
      note: 'The link works for one hour. If you did not sign up for Veritas Tasks, just ignore this email.',
    },
    bg: {
      subject: 'Потвърдете имейла си — Veritas Tasks',
      title: 'Добре дошли на борда',
      text: 'Остава една стъпка: потвърдете, че това е вашият имейл, и ще настроим кораба.',
      button: 'Потвърди имейла',
      note: 'Връзката важи един час. Ако не сте се регистрирали във Veritas Tasks, просто игнорирайте писмото.',
    },
  },
  recovery: {
    link: link('recovery'),
    ru: {
      subject: 'Новый пароль для Veritas Tasks',
      title: 'Задайте новый пароль',
      text: 'Кто-то (надеемся, вы) попросил сбросить пароль. Нажмите на кнопку и придумайте новый.',
      button: 'Задать новый пароль',
      note: 'Ссылка действует один час. Если вы ничего не запрашивали, пароль останется прежним.',
    },
    en: {
      subject: 'A new password for Veritas Tasks',
      title: 'Set a new password',
      text: 'Someone (hopefully you) asked to reset the password. Press the button and pick a new one.',
      button: 'Set a new password',
      note: 'The link works for one hour. If you did not ask for this, your password stays the same.',
    },
    bg: {
      subject: 'Нова парола за Veritas Tasks',
      title: 'Задайте нова парола',
      text: 'Някой (надяваме се вие) поиска нулиране на паролата. Натиснете бутона и измислете нова.',
      button: 'Задай нова парола',
      note: 'Връзката важи един час. Ако не сте поискали това, паролата остава същата.',
    },
  },
  email_change: {
    link: link('email_change'),
    ru: {
      subject: 'Подтвердите смену почты — Veritas Tasks',
      title: 'Смена почты',
      text: 'Подтвердите, что хотите сменить почту аккаунта с {{ .Email }} на {{ .NewEmail }}.',
      button: 'Подтвердить смену',
      note: 'Если вы не меняли почту, не нажимайте на кнопку и смените пароль в настройках.',
    },
    en: {
      subject: 'Confirm your email change — Veritas Tasks',
      title: 'Email change',
      text: 'Confirm that you want to change the account email from {{ .Email }} to {{ .NewEmail }}.',
      button: 'Confirm the change',
      note: 'If you did not change your email, do not press the button and change your password in settings.',
    },
    bg: {
      subject: 'Потвърдете смяната на имейла — Veritas Tasks',
      title: 'Смяна на имейла',
      text: 'Потвърдете, че искате да смените имейла на профила от {{ .Email }} на {{ .NewEmail }}.',
      button: 'Потвърди смяната',
      note: 'Ако не сте сменяли имейла, не натискайте бутона и сменете паролата от настройките.',
    },
  },
  reauthentication: {
    code: true,
    ru: {
      subject: '{{ .Token }} — код подтверждения Veritas Tasks',
      title: 'Код подтверждения',
      text: 'Введите этот код в приложении, чтобы подтвердить действие:',
      note: 'Код действует несколько минут. Никому его не сообщайте — даже нам.',
    },
    en: {
      subject: '{{ .Token }} is your Veritas Tasks code',
      title: 'Confirmation code',
      text: 'Enter this code in the app to confirm the action:',
      note: 'The code works for a few minutes. Never share it with anyone — not even us.',
    },
    bg: {
      subject: '{{ .Token }} — код за потвърждение от Veritas Tasks',
      title: 'Код за потвърждение',
      text: 'Въведете този код в приложението, за да потвърдите действието:',
      note: 'Кодът важи няколко минути. Не го споделяйте с никого — дори с нас.',
    },
  },
  password_changed_notification: {
    ru: {
      subject: 'Пароль изменён — Veritas Tasks',
      title: 'Пароль изменён',
      text: 'Пароль от вашего аккаунта {{ .Email }} только что изменили.',
      note: 'Если это были не вы, сразу восстановите пароль на странице входа.',
    },
    en: {
      subject: 'Password changed — Veritas Tasks',
      title: 'Password changed',
      text: 'The password of your account {{ .Email }} was just changed.',
      note: 'If this was not you, reset your password on the sign-in page right away.',
    },
    bg: {
      subject: 'Паролата е сменена — Veritas Tasks',
      title: 'Паролата е сменена',
      text: 'Паролата на профила ви {{ .Email }} току-що беше сменена.',
      note: 'Ако не сте били вие, веднага възстановете паролата от страницата за вход.',
    },
  },
  email_changed_notification: {
    ru: {
      subject: 'Почта изменена — Veritas Tasks',
      title: 'Почта изменена',
      text: 'Почта аккаунта изменена с {{ .OldEmail }} на {{ .Email }}.',
      note: 'Если это были не вы, восстановите доступ через «Забыли пароль?» и смените пароль.',
    },
    en: {
      subject: 'Email changed — Veritas Tasks',
      title: 'Email changed',
      text: 'The account email was changed from {{ .OldEmail }} to {{ .Email }}.',
      note: 'If this was not you, recover access with “Forgot password?” and change your password.',
    },
    bg: {
      subject: 'Имейлът е сменен — Veritas Tasks',
      title: 'Имейлът е сменен',
      text: 'Имейлът на профила беше сменен от {{ .OldEmail }} на {{ .Email }}.',
      note: 'Ако не сте били вие, възстановете достъпа чрез „Забравена парола?“ и сменете паролата.',
    },
  },
};

const branch = (pick) =>
  `{{ if eq .Data.locale "ru" }}${pick('ru')}{{ else if eq .Data.locale "bg" }}${pick('bg')}{{ else }}${pick('en')}{{ end }}`;

function body(key, spec) {
  const block = (loc) => {
    const c = spec[loc];
    const action = spec.code
      ? `<p style="margin:28px 0 8px;font:600 34px/1.2 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.3em;color:#e8edfa">{{ .Token }}</p>`
      : spec.link
        ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 8px"><tr><td style="border-radius:10px;background:#5ce1ee"><a href="${spec.link}" style="display:inline-block;padding:14px 26px;font:600 16px/1 Arial,sans-serif;color:#04161a;text-decoration:none;border-radius:10px">${c.button}</a></td></tr></table>`
        : '';
    return `<h1 style="margin:0 0 12px;font:600 24px/1.25 Arial,sans-serif;color:#e8edfa">${c.title}</h1>
<p style="margin:0;font:16px/1.6 Arial,sans-serif;color:#b2bcd3">${c.text}</p>
${action}
<p style="margin:24px 0 0;font:13px/1.6 Arial,sans-serif;color:#8791ae">${c.note}</p>`;
  };
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark"></head>
<body style="margin:0;padding:0;background:#060912">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#060912;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px">
<tr><td style="padding:0 8px 20px"><img src="{{ .SiteURL }}/brand/veritas-email-logo.png" width="180" height="40" alt="Veritas Tasks" style="display:block;border:0"></td></tr>
<tr><td style="background:#0e1422;border:1px solid #1d2842;border-radius:18px;padding:32px 28px">
${branch(block)}
</td></tr>
<tr><td style="padding:20px 8px 0;font:12px/1.6 Arial,sans-serif;color:#5c6788">Veritas Tasks</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

const subjects = {};
for (const [key, spec] of Object.entries(copy)) {
  writeFileSync(`supabase/templates/${key}.html`, body(key, spec));
  subjects[key] = branch((loc) => spec[loc].subject);
  console.log(`supabase/templates/${key}.html`);
}
writeFileSync('supabase/templates/subjects.json', `${JSON.stringify(subjects, null, 2)}\n`);
console.log('supabase/templates/subjects.json');
