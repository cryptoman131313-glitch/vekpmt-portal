// ═══════════════════════════════════════════════════════════════
// PRODUCTION SEED
// Создаёт минимально необходимые данные для запуска системы:
//   — одного руководителя (email и пароль задаются через env)
//   — справочники: типы документов, характеристики и марки оборудования
//
// Никаких тестовых менеджеров, инженеров, клиентов, заявок.
// Безопасно запускать повторно — используется ON CONFLICT.
// ═══════════════════════════════════════════════════════════════

const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function seed() {
  const adminEmail    = (process.env.ADMIN_EMAIL    || 'admin@example.com').toLowerCase().trim();
  const adminPassword =  process.env.ADMIN_PASSWORD || 'ChangeMe_OnFirstLogin_1234!';
  const adminName     =  process.env.ADMIN_NAME     || 'Руководитель';

  const client = await pool.connect();
  try {
    const hash = await bcrypt.hash(adminPassword, 12);

    // 1. Руководитель
    await client.query(`
      INSERT INTO users (email, password_hash, name, role, avatar, is_active)
      VALUES ($1, $2, $3, 'director', 'РК', true)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        is_active = true
    `, [adminEmail, hash, adminName]);

    // 2. Типы документов (справочник)
    const documentTypes = [
      { id: 'passport',    name: 'Паспорт оборудования' },
      { id: 'manual',      name: 'Руководство по эксплуатации' },
      { id: 'maintenance', name: 'Регламент ТО' },
      { id: 'warranty',    name: 'Гарантийный талон' },
      { id: 'certificate', name: 'Сертификат соответствия' },
      { id: 'contract',    name: 'Договор' },
      { id: 'act',         name: 'Акт выполненных работ' },
      { id: 'scheme',      name: 'Схема / Чертёж' },
      { id: 'photo',       name: 'Фотографии' },
      { id: 'general',     name: 'Прочее' },
    ];
    await client.query(
      `INSERT INTO system_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      ['document_types', JSON.stringify(documentTypes)]
    );

    // 3. Характеристики оборудования (справочник)
    const equipmentFields = [
      { id: 'purchase_date',     name: 'Дата покупки',        type: 'date' },
      { id: 'warranty_until',    name: 'Гарантия до',         type: 'date' },
      { id: 'installation_date', name: 'Дата установки',      type: 'date' },
      { id: 'location',          name: 'Место установки',     type: 'text' },
      { id: 'condition',         name: 'Состояние',           type: 'text' },
      { id: 'power',             name: 'Мощность (кВт)',      type: 'text' },
      { id: 'weight',            name: 'Вес (кг)',            type: 'text' },
      { id: 'dimensions',        name: 'Габариты (мм)',       type: 'text' },
      { id: 'voltage',           name: 'Напряжение питания',  type: 'text' },
      { id: 'performance',       name: 'Производительность',  type: 'text' },
    ];
    await client.query(
      `INSERT INTO system_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = $2`,
      ['equipment_fields', JSON.stringify(equipmentFields)]
    );

    // 4. Марки оборудования (справочник, можно редактировать в UI)
    const equipmentBrands = [
      { id: 'other', name: 'Другая' },
    ];
    await client.query(
      `INSERT INTO system_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      ['equipment_brands', JSON.stringify(equipmentBrands)]
    );

    console.log('════════════════════════════════════════════════');
    console.log('   Базовые данные созданы');
    console.log('════════════════════════════════════════════════');
    console.log(`   Руководитель: ${adminEmail}`);
    console.log(`   Пароль:       ${process.env.ADMIN_PASSWORD ? '(из ADMIN_PASSWORD)' : adminPassword}`);
    console.log('');
    console.log('   ⚠️  Обязательно смени пароль после первого входа!');
    console.log('════════════════════════════════════════════════');

  } catch (err) {
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    pool.end();
  }
}

seed();
