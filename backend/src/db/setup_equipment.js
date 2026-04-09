const pool = require('./pool');

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key VARCHAR(100) PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    ALTER TABLE equipment ADD COLUMN IF NOT EXISTS characteristics JSONB DEFAULT '{}'
  `);
  const defaultFields = [
    { id: 'perf', name: 'Производительность', unit: 'уп/мин' },
    { id: 'power', name: 'Мощность', unit: 'кВт' },
    { id: 'voltage', name: 'Напряжение питания', unit: 'В' },
    { id: 'dimensions', name: 'Габариты', unit: 'мм' },
    { id: 'weight', name: 'Масса', unit: 'кг' },
    { id: 'year', name: 'Год выпуска', unit: '' },
    { id: 'install_date', name: 'Дата установки', unit: '' },
    { id: 'warranty_until', name: 'Гарантия до', unit: '' },
  ];
  await pool.query(
    `INSERT INTO system_settings (key, value) VALUES ('equipment_fields', $1)
     ON CONFLICT (key) DO NOTHING`,
    [JSON.stringify(defaultFields)]
  );
  console.log('OK');
  pool.end();
}

run().catch(e => { console.error(e.message); pool.end(); });
