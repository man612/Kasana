import { request } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';

const baseURL = new URL(process.env.LAJUR_PROFILE_ORIGIN ?? 'http://localhost:8851').origin;
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname)) {
  throw new Error('The audit fixture requires an isolated loopback API.');
}

const historyMonths = 20;
const now = new Date();
const jakartaNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
const yesterday = new Date(now.getTime() - 86_400_000).toISOString();
const email = `dashboard-audit-${randomUUID()}@test.local`;
const password = 'SyntheticDashboard-123456!';
const api = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } });
const counts = {};
const unsupported = [];

async function send({ path, data, method = 'POST', allowMissing = false }) {
  const result = await api.fetch(`/api/v1${path}`, { method, data });
  if (allowMissing && result.status() === 404) return;
  if (!result.ok())
    throw new Error(`${method} ${path} returned HTTP ${result.status()}: ${(await result.text()).slice(0, 240)}`);
  const body = await result.text();
  if (!body) return;
  const parsed = JSON.parse(body);
  return parsed.response ?? parsed;
}

async function attempt({ label, run }) {
  try {
    return await run();
  } catch (error) {
    unsupported.push({ label, error: error.message });
  }
}

const id = (model) => (Array.isArray(model) ? model[0] : model).id;
const create = async ({ collection, path, data }) => {
  const created = await send({ path, data });
  counts[collection] = (counts[collection] ?? 0) + 1;
  return created;
};
const dateInMonth = ({ offset, day, hour = 10 }) =>
  new Date(Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth() + offset, day, hour - 7, (day * 7) % 60));
const withinHistory = (date) => (date < now ? date.toISOString() : yesterday);
const fixtureWidgets = [
  'balance-trend',
  'latest-records',
  'subscriptions-overview',
  'spending-categories',
  'spending-pace',
  'tag-analysis',
  'category-spending-tracker',
  'cash-flow',
  'taxes',
  'net-worth',
  'cash-accounts',
  'assets-liabilities',
  'credit-utilization',
  'planned-overview',
  'budget',
  'trackers',
  'goals',
  'fire-progress',
];

try {
  // Every run creates a fresh synthetic identity. No writes target existing users.
  await send({ path: '/auth/sign-up/email', data: { email, password, name: 'Audit Rumah Tangga' } });
  await send({ path: '/tests/verify-email', data: { email }, allowMissing: true });
  await send({ path: '/auth/sign-in/email', data: { email, password } });
  await send({ path: '/user/currencies/base', data: { currencyCode: 'IDR' } });
  await send({ path: '/user/currencies', data: { currencies: [{ currencyCode: 'IDR' }] } });
  await send({
    path: '/user/settings/onboarding',
    method: 'PUT',
    data: { isDismissed: true, dismissedAt: now.toISOString() },
  });

  const accounts = {};
  for (const [name, accountCategory, initialBalance, creditLimit] of [
    ['BCA Gaji', 'current-account', 2_400_000, 0],
    ['Jago Dana Darurat', 'saving', 12_000_000, 0],
    ['Mandiri Belanja', 'current-account', 835_000, 0],
    ['GoPay Harian', 'digital-wallet', 350_000, 0],
    ['DANA Keluarga', 'digital-wallet', 34_900, 0],
    ['ShopeePay Cadangan', 'digital-wallet', 0, 0],
    ['Dompet Tunai', 'cash', 225_000, 0],
    ['Kartu Kredit Belanja', 'credit-card', -360_000, 8_000_000],
  ]) {
    accounts[name] = id(
      await create({
        collection: 'accounts',
        path: '/accounts',
        data: { name, accountCategory, initialBalance, creditLimit, currencyCode: 'IDR' },
      }),
    );
  }

  const categories = {};
  for (const [name, color] of [
    ['Gaji dan bonus', '#2563eb'],
    ['Belanja dapur', '#d97706'],
    ['Rumah dan tagihan', '#7c3aed'],
    ['Kendaraan dan transportasi', '#0f766e'],
    ['Kesehatan dan keluarga', '#e11d48'],
    ['Hiburan', '#6d28d9'],
    ['Pajak penghasilan lepas', '#b45309'],
  ]) {
    categories[name] = id(await create({ collection: 'categories', path: '/categories', data: { name, color } }));
  }

  const tags = [];
  for (const [name, color] of [
    ['rutin', '#2563eb'],
    ['keluarga', '#16a34a'],
    ['perjalanan', '#d97706'],
    ['perawatan', '#9333ea'],
  ]) {
    tags.push(id(await create({ collection: 'tags', path: '/tags', data: { name, color } })));
  }

  const store = await attempt({
    label: 'payee',
    run: () =>
      create({
        collection: 'payees',
        path: '/payees',
        data: { name: 'Pasar Pagi Koperasi Pangan dan Kebutuhan Keluarga' },
      }),
  });
  const transaction = async ({ account, category, amount, note, time, ...extra }) =>
    create({
      collection: 'transactions',
      path: '/transactions',
      data: {
        accountId: accounts[account],
        categoryId: categories[category],
        amount,
        note,
        time,
        transactionType: 'expense',
        paymentType: 'qris',
        transferNature: 'not_transfer',
        ...extra,
      },
    });

  const transfer = ({ destination, amount, time, note }) =>
    transaction({
      account: 'BCA Gaji',
      category: 'Gaji dan bonus',
      amount,
      note,
      time,
      paymentType: 'bankTransfer',
      destinationAccountId: accounts[destination],
      destinationAmount: amount,
      transferNature: 'transfer_between_user_accounts',
    });

  for (let shift = historyMonths - 1; shift >= 0; shift--) {
    const offset = -shift;
    const monthHigh = shift % 7 === 0;
    const routine = [
      [
        'BCA Gaji',
        'Gaji dan bonus',
        9_300_000 + (shift % 5) * 175_000,
        'Gaji bulanan perusahaan',
        1,
        8,
        'income',
        'bankTransfer',
      ],
      [
        'Mandiri Belanja',
        'Belanja dapur',
        452_500 + (shift % 8) * 66_000,
        'Belanja mingguan pasar dan kebutuhan rumah',
        4,
        8,
        'expense',
        'qris',
      ],
      ['BCA Gaji', 'Rumah dan tagihan', 2_850_000, 'Sewa rumah bulanan', 5, 13, 'expense', 'bankTransfer'],
      [
        'BCA Gaji',
        'Rumah dan tagihan',
        382_700 + (shift % 5) * 35_000,
        'Listrik dan internet rumah',
        9,
        19,
        'expense',
        'autoDebit',
      ],
      [
        'GoPay Harian',
        'Kendaraan dan transportasi',
        128_500 + (shift % 4) * 28_000,
        'BBM dan parkir perjalanan kerja',
        12,
        17,
        'expense',
        'eWallet',
      ],
      [
        'Dompet Tunai',
        'Kesehatan dan keluarga',
        monthHigh ? 1_365_000 : 178_000,
        'Keperluan keluarga dan apotek',
        16,
        16,
        'expense',
        'cash',
      ],
      [
        'Kartu Kredit Belanja',
        'Hiburan',
        monthHigh ? 675_000 : 92_000,
        'Bioskop, makan sore, dan rekreasi keluarga',
        20,
        18,
        'expense',
        'creditCard',
      ],
    ];
    for (const [account, category, amount, note, day, hour, transactionType, paymentType] of routine) {
      await transaction({
        account,
        category,
        amount,
        note,
        time: withinHistory(dateInMonth({ offset, day, hour })),
        transactionType,
        paymentType,
        tagIds: [tags[0]],
        ...(store && category === 'Belanja dapur' ? { payeeId: id(store) } : {}),
      });
    }
    for (const [destination, amount, description] of [
      ['Mandiri Belanja', 950_000, 'Alokasi belanja bulanan'],
      ['GoPay Harian', 340_000, 'Isi ulang dompet digital'],
      ['Dompet Tunai', monthHigh ? 1_400_000 : 215_000, 'Tarik tunai untuk keluarga'],
      ['Kartu Kredit Belanja', monthHigh ? 675_000 : 92_000, 'Bayar periode kartu kredit'],
    ]) {
      await transfer({
        destination,
        amount,
        note: description,
        time: withinHistory(dateInMonth({ offset, day: 3, hour: 10 })),
      });
    }
    if (shift % 4 === 0) {
      await transaction({
        account: 'BCA Gaji',
        category: 'Gaji dan bonus',
        amount: 1_275_000,
        note: 'Honor desain lepas',
        time: withinHistory(dateInMonth({ offset, day: 24, hour: 20 })),
        transactionType: 'income',
        paymentType: 'bankTransfer',
      });
      await transaction({
        account: 'BCA Gaji',
        category: 'Pajak penghasilan lepas',
        amount: 63_750,
        note: 'Setoran pajak penghasilan lepas',
        time: withinHistory(dateInMonth({ offset, day: 25, hour: 9 })),
        paymentType: 'bankTransfer',
        tagIds: [tags[0]],
      });
    }
  }

  const vehicleTrackerTransactions = [];
  for (const [name, items] of [
    [
      'Perjalanan Bandung',
      [
        ['Tiket kereta', 385_000],
        ['Hotel keluarga', 1_280_000],
        ['Makan dan oleh-oleh', 292_500],
      ],
    ],
    [
      'Perawatan kendaraan',
      [
        ['Bengkel servis berkala', 560_000],
        ['Ganti oli', 135_000],
        ['Cuci dan parkir', 59_000],
      ],
    ],
  ]) {
    const transactionIds = [];
    for (const [note, amount] of items) {
      transactionIds.push(
        id(
          await transaction({
            account: 'BCA Gaji',
            category: 'Kendaraan dan transportasi',
            amount,
            note,
            time: yesterday,
            tagIds: tags,
          }),
        ),
      );
    }
    await create({ collection: 'groups', path: '/transaction-groups', data: { name, transactionIds } });
    if (name === 'Perawatan kendaraan') vehicleTrackerTransactions.push(...transactionIds);
  }

  await transfer({ destination: 'Jago Dana Darurat', amount: 900_000, note: 'Sisihkan dana darurat', time: yesterday });

  const reimbursement = await transaction({
    account: 'BCA Gaji',
    category: 'Belanja dapur',
    amount: 285_000,
    time: yesterday,
    note: 'Pesanan rumah tangga dengan retur sebagian. '.repeat(15).trim(),
    tagIds: tags,
  });
  await attempt({
    label: 'partial refund',
    run: () =>
      transaction({
        account: 'BCA Gaji',
        category: 'Belanja dapur',
        amount: 45_000,
        time: yesterday,
        note: 'Retur sebagian barang',
        transactionType: 'income',
        refundForTxId: id(reimbursement),
        refundForAmount: 45_000,
      }),
  });

  for (const [label, value, interestRate, paymentDayOfMonth] of [
    ['Cicilan motor keluarga', 9_600_000, 8, 27],
    ['Pinjaman keluarga tanpa bunga', 2_500_000, 0, 8],
    ['Angsuran peralatan kerja', 950_000, 0, 25],
  ]) {
    await attempt({
      label,
      run: async () => {
        const loan = await create({
          collection: 'loans',
          path: '/loans',
          data: {
            name: label,
            currencyCode: 'IDR',
            initialBalance: value,
            originalPrincipal: value,
            loanType: 'mortgage',
            interestRate,
            startDate: dateInMonth({ offset: -9, day: 1 }).toISOString().slice(0, 10),
            paymentDayOfMonth,
            termMonths: 24,
          },
        });
        const payment = await transaction({
          account: 'BCA Gaji',
          category: 'Rumah dan tagihan',
          amount: value === 950_000 ? value : 450_000,
          note: `Pembayaran ${label}`,
          time: yesterday,
          paymentType: 'bankTransfer',
        });
        await send({ path: `/loans/${id(loan)}/link-payments`, data: { transactionIds: [id(payment)] } });
        counts.loanPayments = (counts.loanPayments ?? 0) + 1;
      },
    });
  }

  for (const [name, make, model, vehicleClass, vehicleType, year, purchasePrice, licensePlate] of [
    ['Motor harian', 'Yamaha', 'NMAX', 'motorcycle', 'scooter', 2023, 28_000_000, 'ZZ 6123 XZ'],
    ['Mobil keluarga', 'Toyota', 'Corolla', 'sedan', 'sedan', 2020, 224_500_000, 'ZZ 7103 XZ'],
  ]) {
    await attempt({
      label: name,
      run: () =>
        create({
          collection: 'vehicles',
          path: '/vehicles',
          data: {
            name,
            make,
            model,
            vehicleClass,
            vehicleType,
            year,
            purchasePrice,
            licensePlate,
            currencyCode: 'IDR',
            purchaseDate: dateInMonth({ offset: -17, day: 2 }).toISOString().slice(0, 10),
            depreciationPreset: 'custom',
            customAnnualRatePct: 8,
          },
        }),
    });
  }

  for (const [name, amount, account, type] of [
    ['Internet rumah', 315_000, 'BCA Gaji', 'bill'],
    ['Streaming keluarga', 65_000, 'GoPay Harian', 'subscription'],
    ['Iuran lingkungan', 110_000, 'Mandiri Belanja', 'bill'],
  ]) {
    await attempt({
      label: name,
      run: () =>
        create({
          collection: 'subscriptions',
          path: '/subscriptions',
          data: {
            name,
            expectedAmount: amount,
            expectedCurrencyCode: 'IDR',
            frequency: 'monthly',
            transactionType: 'expense',
            type,
            startDate: new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10),
            accountId: accounts[account],
            categoryId: categories['Rumah dan tagihan'],
          },
        }),
    });
  }
  await attempt({
    label: 'planned transaction',
    run: () =>
      transaction({
        account: 'BCA Gaji',
        category: 'Rumah dan tagihan',
        amount: 425_000,
        note: 'Tagihan air dan listrik terencana',
        time: new Date(now.getTime() + 4 * 86_400_000).toISOString(),
        isPlanned: true,
      }),
  });

  for (const [name, isEnabled, phrase, category] of [
    ['Kategori otomatis bengkel', true, 'Bengkel', 'Kendaraan dan transportasi'],
    ['Tandai belanja pasar', false, 'Pasar', 'Belanja dapur'],
  ]) {
    await attempt({
      label: name,
      run: () =>
        create({
          collection: 'automations',
          path: '/automations',
          data: {
            name,
            isEnabled,
            conditions: { match: 'all', items: [{ field: 'note', operator: 'contains_any', value: [phrase] }] },
            actions: [{ type: 'set_category', categoryId: categories[category] }],
          },
        }),
    });
  }

  await attempt({
    label: 'portfolio cash funding',
    run: async () => {
      const portfolio = await create({
        collection: 'portfolios',
        path: '/investments/portfolios',
        data: { name: 'Investasi latihan IDR' },
      });
      await create({
        collection: 'portfolioTransfers',
        path: `/investments/portfolios/${id(portfolio)}/transfer/from-account`,
        data: {
          accountId: accounts['BCA Gaji'],
          amount: '2750000',
          date: yesterday.slice(0, 10),
          description: 'Setoran investasi sintetis',
        },
      });
    },
  });
  await attempt({
    label: 'goal',
    run: () =>
      create({
        collection: 'goals',
        path: '/goals',
        data: {
          name: 'Dana darurat rumah tangga',
          currencyCode: 'IDR',
          targetAmount: 24_000_000,
          plannedMonthly: 900_000,
          accounts: [{ accountId: accounts['Jago Dana Darurat'], sharePercent: 100 }],
        },
      }),
  });
  await attempt({
    label: 'budget',
    run: async () => {
      const budget = await create({
        collection: 'budgetPlans',
        path: '/budget-plans',
        data: {
          name: 'Anggaran rumah tangga',
          type: 'category_caps',
          cadence: 'months',
          anchorDate: dateInMonth({ offset: -2, day: 1 }).toISOString().slice(0, 10),
          accountIds: [accounts['BCA Gaji'], accounts['Mandiri Belanja'], accounts['GoPay Harian']],
          withSuggestedLines: false,
        },
      });
      const planId = id(budget.plan ?? budget);
      for (const category of ['Belanja dapur', 'Rumah dan tagihan', 'Kendaraan dan transportasi']) {
        await create({
          collection: 'budgetLines',
          path: `/budget-plans/${planId}/lines`,
          data: { name: category, categoryIds: [categories[category]] },
        });
      }
    },
  });
  await attempt({
    label: 'tracker',
    run: async () => {
      const tracker = await create({
        collection: 'trackers',
        path: '/trackers',
        data: {
          name: 'Kendali biaya kendaraan',
          startDate: dateInMonth({ offset: -1, day: 1 }).toISOString(),
          limitAmount: 1_300_000,
        },
      });
      await send({
        method: 'POST',
        path: `/trackers/${id(tracker)}/transactions`,
        data: { transactionIds: vehicleTrackerTransactions },
      });
    },
  });

  const widgetConfigs = {
    'latest-records': { compact: true, showTime: true },
    'tag-analysis': { tagIds: tags.slice(0, 3) },
    'category-spending-tracker': {
      selectedCategoryIds: ['Belanja dapur', 'Rumah dan tagihan', 'Kendaraan dan transportasi'].map(
        (category) => categories[category],
      ),
    },
    taxes: { months: '12' },
  };
  await send({
    path: '/user/settings',
    method: 'PATCH',
    data: {
      taxCategoryIds: [categories['Pajak penghasilan lepas']],
      dashboard: {
        widgets: fixtureWidgets.map((widgetId) => ({
          widgetId,
          colSpan: widgetId === 'balance-trend' ? 2 : 1,
          ...(widgetConfigs[widgetId] && { config: widgetConfigs[widgetId] }),
        })),
      },
    },
  });

  const storagePath = process.env.LAJUR_AUDIT_STATE_PATH;
  if (storagePath) {
    const file = await open(storagePath, 'wx', 0o600);
    try {
      await file.writeFile(JSON.stringify(await api.storageState()));
    } finally {
      await file.close();
    }
  }
  console.log(JSON.stringify({ historyMonths, widgetCount: fixtureWidgets.length, counts, unsupported }, null, 2));
} finally {
  await api.dispose();
}
