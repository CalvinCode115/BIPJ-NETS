/**
 * Demo transaction history — distinct spending personas (Feb–Jun 2026).
 * Alex: foodie + commuter | Sarah: shopper + groceries | Cheng: travel + wellness | Adam: casual dining + retail
 */

const CATEGORY_META = {
  Coffee: { icon: 'cafe', icon_color: '#2f80ed' },
  Drinks: { icon: 'water', icon_color: '#e84393' },
  Dining: { icon: 'restaurant', icon_color: '#eb5757' },
  Groceries: { icon: 'cart', icon_color: '#27ae60' },
  Transport: { icon: 'car', icon_color: '#9b51e0' },
  Retail: { icon: 'shirt', icon_color: '#f2994a' },
  Travel: { icon: 'airplane', icon_color: '#6c63ff' },
  Health: { icon: 'medkit', icon_color: '#9b51e0' },
  Transfer: { icon: 'arrow-down-circle', icon_color: '#27ae60' },
};

function debit(id, userId, cardId, merchant, category, amount, occurredAt, subtitle = 'Card payment') {
  const meta = CATEGORY_META[category] || { icon: 'receipt', icon_color: '#6c63ff' };
  return {
    id,
    user_id: userId,
    card_id: cardId,
    merchant,
    category,
    subtitle,
    amount: -Math.abs(amount),
    txn_type: 'debit',
    icon: meta.icon,
    icon_color: meta.icon_color,
    occurred_at: occurredAt,
  };
}

function credit(id, userId, cardId, merchant, category, amount, occurredAt, subtitle) {
  const meta = CATEGORY_META[category] || { icon: 'arrow-down-circle', icon_color: '#27ae60' };
  return {
    id,
    user_id: userId,
    card_id: cardId,
    merchant,
    category,
    subtitle,
    amount: Math.abs(amount),
    txn_type: 'credit',
    icon: meta.icon,
    icon_color: meta.icon_color,
    occurred_at: occurredAt,
  };
}

/** Salary lands on linked debit; user tops up prepaid separately (realistic flow). */
function prepaidTopUp(idBase, userId, linkedId, prepaidId, amount, occurredAt) {
  return [
    debit(
      `${idBase}_out`,
      userId,
      linkedId,
      'Prepaid Top-up',
      'Transfer',
      amount,
      occurredAt,
      'Transfer to NETS Prepaid'
    ),
    credit(
      `${idBase}_in`,
      userId,
      prepaidId,
      'NETS Prepaid Top-up',
      'Transfer',
      amount,
      occurredAt,
      'Top-up from linked debit'
    ),
  ];
}

function monthlyPayroll(id, userId, debitCardId, amount, monthPrefix) {
  return credit(
    id,
    userId,
    debitCardId,
    'Salary / Payroll',
    'Transfer',
    amount,
    `${monthPrefix}-01T09:00:00`,
    'Monthly salary'
  );
}

function monthlyPrepaidLoad(idBase, userId, linkedId, prepaidId, amount, monthPrefix) {
  return prepaidTopUp(
    idBase,
    userId,
    linkedId,
    prepaidId,
    amount,
    `${monthPrefix}-02T10:30:00`
  );
}

function alexTransactions() {
  const u = 'user_1';
  const prepaid = 'card_prepaid_1';
  const cashcard = 'card_cashcard_1';
  const linkedDebit = 'card_uob_1';

  return [
    // --- June 2026 (foodie + commute week) ---
    monthlyPayroll('txn_a_j1', u, linkedDebit, 3200, '2026-06'),
    ...monthlyPrepaidLoad('txn_a_j1tu', u, linkedDebit, prepaid, 150, '2026-06'),
    debit('txn_a_j2', u, prepaid, 'Starbucks Raffles Place', 'Coffee', 8.5, '2026-06-02T08:15:00'),
    debit('txn_a_j3', u, cashcard, 'SimplyGo Transit', 'Transport', 1.82, '2026-06-02T08:45:00', 'MRT / bus fare'),
    debit('txn_a_j4', u, prepaid, 'Ya Kun Kaya Toast', 'Dining', 7.2, '2026-06-03T08:30:00'),
    debit('txn_a_j5', u, prepaid, 'Starbucks One Raffles', 'Coffee', 9.2, '2026-06-04T14:10:00'),
    debit('txn_a_j6', u, prepaid, 'Grab', 'Transport', 14.5, '2026-06-05T18:20:00', 'Ride-hail payment'),
    debit('txn_a_j7', u, prepaid, 'Ichiban Sushi', 'Dining', 38.5, '2026-06-06T19:30:00'),
    debit('txn_a_j8', u, cashcard, 'SimplyGo Transit', 'Transport', 1.82, '2026-06-07T09:00:00', 'MRT / bus fare'),
    debit('txn_a_j9', u, prepaid, 'Dough Culture', 'Dining', 12.8, '2026-06-08T12:45:00'),
    debit('txn_a_j10', u, prepaid, 'Starbucks Raffles Place', 'Coffee', 8.5, '2026-06-09T08:20:00'),
    debit('txn_a_j11', u, prepaid, 'Pizza Hut', 'Dining', 26.4, '2026-06-10T20:00:00'),
    debit('txn_a_j12', u, prepaid, 'Grab', 'Transport', 16.2, '2026-06-11T07:50:00', 'Ride-hail payment'),
    debit('txn_a_j13', u, prepaid, 'NTUC FairPrice', 'Groceries', 18.6, '2026-06-12T19:00:00'),
    debit('txn_a_j14', u, prepaid, 'Killiney Kopitiam', 'Dining', 6.5, '2026-06-14T08:00:00'),
    debit('txn_a_j15', u, cashcard, 'SimplyGo Transit', 'Transport', 1.82, '2026-06-14T08:40:00', 'MRT / bus fare'),
    debit('txn_a_j16', u, prepaid, 'Ichiban Sushi', 'Dining', 24, '2026-06-15T19:00:00'),
    debit('txn_a_j17', u, prepaid, 'Starbucks Raffles Place', 'Coffee', 8.5, '2026-06-16T14:30:00'),
    debit('txn_a_j18', u, prepaid, 'Uniqlo Orchard', 'Retail', 26, '2026-06-17T16:00:00'),
    debit('txn_a_j19', u, prepaid, 'Grab', 'Transport', 15, '2026-06-18T08:15:00', 'Ride-hail payment'),
    debit('txn_a_j20', u, prepaid, 'Marina Bay Hawker', 'Dining', 9.8, '2026-06-19T12:30:00'),
    debit('txn_a_j21', u, prepaid, 'Starbucks One Raffles', 'Coffee', 9.2, '2026-06-20T09:00:00'),
    debit('txn_a_j22', u, cashcard, 'SimplyGo Transit', 'Transport', 1.82, '2026-06-21T08:30:00', 'MRT / bus fare'),
    debit('txn_a_j23', u, prepaid, 'Grab', 'Transport', 12.5, '2026-06-22T18:00:00', 'Ride-hail payment'),

    // --- May 2026 (similar pattern, slightly lower dining) ---
    monthlyPayroll('txn_a_m1', u, linkedDebit, 3200, '2026-05'),
    ...monthlyPrepaidLoad('txn_a_m1tu', u, linkedDebit, prepaid, 150, '2026-05'),
    debit('txn_a_m2', u, prepaid, 'Starbucks Raffles Place', 'Coffee', 8.5, '2026-05-03T08:10:00'),
    debit('txn_a_m3', u, prepaid, 'Grab', 'Transport', 18, '2026-05-05T08:20:00', 'Ride-hail payment'),
    debit('txn_a_m4', u, prepaid, 'Ichiban Sushi', 'Dining', 22, '2026-05-07T19:00:00'),
    debit('txn_a_m5', u, cashcard, 'SimplyGo Transit', 'Transport', 1.82, '2026-05-08T08:45:00', 'MRT / bus fare'),
    debit('txn_a_m6', u, prepaid, 'Starbucks One Raffles', 'Coffee', 9.2, '2026-05-10T14:00:00'),
    debit('txn_a_m7', u, prepaid, 'Killiney Kopitiam', 'Dining', 6.5, '2026-05-12T08:00:00'),
    debit('txn_a_m8', u, prepaid, 'Cold Storage', 'Groceries', 11, '2026-05-14T18:30:00'),
    debit('txn_a_m9', u, prepaid, 'Grab', 'Transport', 17.5, '2026-05-16T19:10:00', 'Ride-hail payment'),
    debit('txn_a_m10', u, prepaid, 'Pizza Hut', 'Dining', 24.9, '2026-05-18T20:15:00'),
    debit('txn_a_m11', u, prepaid, 'Starbucks Raffles Place', 'Coffee', 8.5, '2026-05-20T08:30:00'),
    debit('txn_a_m12', u, prepaid, 'Dough Culture', 'Dining', 11.5, '2026-05-22T12:00:00'),
    debit('txn_a_m13', u, cashcard, 'SimplyGo Transit', 'Transport', 1.82, '2026-05-24T09:00:00', 'MRT / bus fare'),
    debit('txn_a_m14', u, prepaid, 'Marina Bay Hawker', 'Dining', 8.5, '2026-05-26T12:30:00'),
    debit('txn_a_m15', u, prepaid, 'Grab', 'Transport', 14.8, '2026-05-28T18:00:00', 'Ride-hail payment'),

    // --- Feb–Apr (lighter, for report trend chart) ---
    ...monthlyPrepaidLoad('txn_a_g0tu', u, linkedDebit, prepaid, 120, '2026-03'),
    ...monthlyPrepaidLoad('txn_a_h0tu', u, linkedDebit, prepaid, 120, '2026-04'),
    ...monthlyPrepaidLoad('txn_a_f0tu', u, linkedDebit, prepaid, 100, '2026-02'),
    debit('txn_a_f1', u, prepaid, 'Starbucks Raffles Place', 'Coffee', 8.5, '2026-02-12T08:00:00'),
    debit('txn_a_f2', u, prepaid, 'Grab', 'Transport', 12, '2026-02-18T18:00:00', 'Ride-hail payment'),
    debit('txn_a_f3', u, prepaid, 'Ichiban Sushi', 'Dining', 20, '2026-02-22T19:00:00'),
    debit('txn_a_g1', u, prepaid, 'Starbucks Raffles Place', 'Coffee', 8.5, '2026-03-08T08:00:00'),
    debit('txn_a_g2', u, prepaid, 'Pizza Hut', 'Dining', 22, '2026-03-15T20:00:00'),
    debit('txn_a_g3', u, prepaid, 'Grab', 'Transport', 15, '2026-03-20T08:00:00', 'Ride-hail payment'),
    debit('txn_a_h1', u, prepaid, 'Starbucks One Raffles', 'Coffee', 9.2, '2026-04-05T09:00:00'),
    debit('txn_a_h2', u, prepaid, 'Ichiban Sushi', 'Dining', 26, '2026-04-12T19:30:00'),
    debit('txn_a_h3', u, prepaid, 'Grab', 'Transport', 16, '2026-04-18T07:45:00', 'Ride-hail payment'),
    debit('txn_a_h4', u, prepaid, 'NTUC FairPrice', 'Groceries', 15.2, '2026-04-25T18:00:00'),
  ];
}

function sarahTransactions() {
  const u = 'user_2';
  const prepaid = 'card_prepaid_2';
  const linked = 'card_dbs_2';

  return [
    // --- June 2026 (shopper + groceries) ---
    monthlyPayroll('txn_s_j1', u, linked, 2800, '2026-06'),
    ...monthlyPrepaidLoad('txn_s_j1tu', u, linked, prepaid, 200, '2026-06'),
    debit('txn_s_j2', u, prepaid, 'Uniqlo Orchard', 'Retail', 45.9, '2026-06-02T14:00:00'),
    debit('txn_s_j3', u, prepaid, 'FairPrice Finest', 'Groceries', 52.3, '2026-06-03T19:30:00'),
    debit('txn_s_j4', u, prepaid, 'Guardian Pharmacy', 'Retail', 18.5, '2026-06-04T12:00:00'),
    debit('txn_s_j5', u, prepaid, 'Toast Box', 'Dining', 6.5, '2026-06-05T09:30:00'),
    debit('txn_s_j6', u, linked, 'H&M VivoCity', 'Retail', 38.2, '2026-06-06T15:45:00'),
    debit('txn_s_j7', u, prepaid, 'Cold Storage', 'Groceries', 34.8, '2026-06-08T18:00:00'),
    debit('txn_s_j8', u, prepaid, 'Changi Airport Duty Free', 'Retail', 68, '2026-06-09T11:00:00'),
    debit('txn_s_j9', u, prepaid, 'Ya Kun Kaya Toast', 'Dining', 8.9, '2026-06-11T07:45:00'),
    debit('txn_s_j10', u, prepaid, 'FairPrice Finest', 'Groceries', 41.6, '2026-06-13T20:00:00'),
    debit('txn_s_j11', u, linked, 'Decathlon Singapore', 'Retail', 59.9, '2026-06-14T16:30:00'),
    debit('txn_s_j12', u, prepaid, 'LiHO Tea', 'Drinks', 6.8, '2026-06-15T10:00:00'),
    debit('txn_s_j13', u, prepaid, 'NTUC FairPrice', 'Groceries', 28.4, '2026-06-17T19:15:00'),
    debit('txn_s_j14', u, prepaid, 'Uniqlo Orchard', 'Retail', 32.5, '2026-06-18T13:00:00'),
    debit('txn_s_j15', u, prepaid, 'Toast Box', 'Dining', 6.5, '2026-06-19T09:30:00'),
    debit('txn_s_j16', u, prepaid, 'Guardian Pharmacy', 'Retail', 12.8, '2026-06-20T11:00:00'),
    debit('txn_s_j17', u, prepaid, 'Cold Storage', 'Groceries', 36.2, '2026-06-21T18:45:00'),

    // --- May 2026 ---
    monthlyPayroll('txn_s_m1', u, linked, 2800, '2026-05'),
    ...monthlyPrepaidLoad('txn_s_m1tu', u, linked, prepaid, 200, '2026-05'),
    debit('txn_s_m2', u, prepaid, 'Uniqlo Orchard', 'Retail', 42, '2026-05-04T14:30:00'),
    debit('txn_s_m3', u, prepaid, 'FairPrice Finest', 'Groceries', 45.2, '2026-05-06T18:30:00'),
    debit('txn_s_m4', u, linked, 'H&M VivoCity', 'Retail', 29.9, '2026-05-08T16:00:00'),
    debit('txn_s_m5', u, prepaid, 'Toast Box', 'Dining', 6.5, '2026-05-10T09:00:00'),
    debit('txn_s_m6', u, prepaid, 'Guardian Pharmacy', 'Retail', 22.4, '2026-05-12T13:00:00'),
    debit('txn_s_m7', u, prepaid, 'Cold Storage', 'Groceries', 31.5, '2026-05-15T19:00:00'),
    debit('txn_s_m8', u, prepaid, 'Decathlon Singapore', 'Retail', 48.5, '2026-05-18T15:00:00'),
    debit('txn_s_m9', u, prepaid, 'Ya Kun Kaya Toast', 'Dining', 8.9, '2026-05-20T08:00:00'),
    debit('txn_s_m10', u, prepaid, 'NTUC FairPrice', 'Groceries', 38.7, '2026-05-22T18:30:00'),
    debit('txn_s_m11', u, prepaid, 'Uniqlo Orchard', 'Retail', 35, '2026-05-25T14:00:00'),
    debit('txn_s_m12', u, prepaid, 'Gong Cha', 'Drinks', 7.5, '2026-05-27T10:30:00'),
    debit('txn_s_m13', u, prepaid, 'FairPrice Finest', 'Groceries', 40.1, '2026-05-29T20:00:00'),

    // --- Feb–Apr (trend) ---
    ...monthlyPrepaidLoad('txn_s_g0tu', u, linked, prepaid, 180, '2026-03'),
    ...monthlyPrepaidLoad('txn_s_h0tu', u, linked, prepaid, 180, '2026-04'),
    ...monthlyPrepaidLoad('txn_s_f0tu', u, linked, prepaid, 150, '2026-02'),
    debit('txn_s_f1', u, prepaid, 'Uniqlo Orchard', 'Retail', 30, '2026-02-10T14:00:00'),
    debit('txn_s_f2', u, prepaid, 'FairPrice Finest', 'Groceries', 35, '2026-02-20T19:00:00'),
    debit('txn_s_g1', u, prepaid, 'Guardian Pharmacy', 'Retail', 15, '2026-03-05T12:00:00'),
    debit('txn_s_g2', u, prepaid, 'Cold Storage', 'Groceries', 28, '2026-03-18T18:00:00'),
    debit('txn_s_h1', u, prepaid, 'H&M VivoCity', 'Retail', 25, '2026-04-08T15:00:00'),
    debit('txn_s_h2', u, prepaid, 'NTUC FairPrice', 'Groceries', 32, '2026-04-22T19:00:00'),
  ];
}

function chengTransactions() {
  const u = 'user_3';
  const prepaid = 'card_prepaid_3';
  const linked = 'card_visa_3';

  return [
    // --- June 2026 (travel + wellness) ---
    monthlyPayroll('txn_c_j1', u, linked, 3500, '2026-06'),
    ...monthlyPrepaidLoad('txn_c_j1tu', u, linked, prepaid, 150, '2026-06'),
    debit('txn_c_j2', u, linked, 'AirAsia', 'Travel', 189, '2026-06-02T20:00:00', 'Flight booking'),
    debit('txn_c_j3', u, linked, 'Agoda', 'Travel', 145, '2026-06-03T21:30:00', 'Hotel deposit'),
    debit('txn_c_j4', u, prepaid, 'Guardian Pharmacy', 'Health', 24.5, '2026-06-04T12:00:00'),
    debit('txn_c_j5', u, prepaid, 'Grab', 'Transport', 28, '2026-06-05T06:00:00', 'Airport ride'),
    debit('txn_c_j6', u, prepaid, 'Din Tai Fung', 'Dining', 42.8, '2026-06-06T13:00:00'),
    debit('txn_c_j7', u, linked, 'Klook', 'Travel', 56, '2026-06-08T19:00:00', 'Activity pass'),
    debit('txn_c_j8', u, prepaid, 'Unity Pharmacy', 'Health', 18.9, '2026-06-10T11:30:00'),
    debit('txn_c_j9', u, prepaid, 'SimplyGo Transit', 'Transport', 1.82, '2026-06-11T08:30:00', 'MRT / bus fare'),
    debit('txn_c_j10', u, linked, 'Booking.com', 'Travel', 210, '2026-06-12T22:00:00', 'Weekend stay'),
    debit('txn_c_j11', u, prepaid, 'Raffles Medical', 'Health', 65, '2026-06-14T10:00:00', 'Clinic visit'),
    debit('txn_c_j12', u, prepaid, 'Toast Box', 'Dining', 7.5, '2026-06-15T08:00:00'),
    debit('txn_c_j13', u, prepaid, 'Grab', 'Transport', 19.5, '2026-06-16T18:30:00', 'Ride-hail payment'),
    debit('txn_c_j14', u, linked, 'Scoot', 'Travel', 165, '2026-06-18T20:15:00', 'Flight booking'),
    debit('txn_c_j15', u, prepaid, 'Guardian Pharmacy', 'Health', 12.4, '2026-06-20T13:00:00'),
    debit('txn_c_j16', u, prepaid, 'Din Tai Fung', 'Dining', 38.2, '2026-06-21T12:30:00'),

    // --- May 2026 (JB weekend + health) ---
    monthlyPayroll('txn_c_m1', u, linked, 3500, '2026-05'),
    ...monthlyPrepaidLoad('txn_c_m1tu', u, linked, prepaid, 130, '2026-05'),
    debit('txn_c_m2', u, linked, 'Agoda', 'Travel', 98, '2026-05-03T21:00:00', 'Hotel booking'),
    debit('txn_c_m3', u, prepaid, 'Grab', 'Transport', 35, '2026-05-04T07:00:00', 'JB trip'),
    debit('txn_c_m4', u, prepaid, 'Causeway Point', 'Retail', 42.5, '2026-05-04T14:00:00'),
    debit('txn_c_m5', u, prepaid, 'Guardian Pharmacy', 'Health', 19.8, '2026-05-07T12:00:00'),
    debit('txn_c_m6', u, prepaid, 'Din Tai Fung', 'Dining', 36.5, '2026-05-09T13:30:00'),
    debit('txn_c_m7', u, linked, 'Klook', 'Travel', 45, '2026-05-12T20:00:00', 'Attraction tickets'),
    debit('txn_c_m8', u, prepaid, 'Unity Pharmacy', 'Health', 15.6, '2026-05-15T11:00:00'),
    debit('txn_c_m9', u, prepaid, 'Grab', 'Transport', 22, '2026-05-17T19:00:00', 'Ride-hail payment'),
    debit('txn_c_m10', u, linked, 'AirAsia', 'Travel', 142, '2026-05-20T21:30:00', 'Flight booking'),
    debit('txn_c_m11', u, prepaid, 'Raffles Medical', 'Health', 48, '2026-05-22T10:30:00', 'Health screening'),
    debit('txn_c_m12', u, prepaid, 'Toast Box', 'Dining', 7.5, '2026-05-24T08:30:00'),
    debit('txn_c_m13', u, prepaid, 'SimplyGo Transit', 'Transport', 1.82, '2026-05-26T08:45:00', 'MRT / bus fare'),

    // --- Feb–Apr (trend) ---
    ...monthlyPrepaidLoad('txn_c_g0tu', u, linked, prepaid, 120, '2026-03'),
    ...monthlyPrepaidLoad('txn_c_h0tu', u, linked, prepaid, 120, '2026-04'),
    ...monthlyPrepaidLoad('txn_c_f0tu', u, linked, prepaid, 105, '2026-02'),
    debit('txn_c_f1', u, linked, 'Agoda', 'Travel', 88, '2026-02-14T20:00:00', 'Hotel booking'),
    debit('txn_c_f2', u, prepaid, 'Guardian Pharmacy', 'Health', 16, '2026-02-20T12:00:00'),
    debit('txn_c_g1', u, linked, 'AirAsia', 'Travel', 120, '2026-03-10T21:00:00', 'Flight booking'),
    debit('txn_c_g2', u, prepaid, 'Din Tai Fung', 'Dining', 35, '2026-03-18T13:00:00'),
    debit('txn_c_h1', u, linked, 'Booking.com', 'Travel', 135, '2026-04-08T22:00:00', 'Hotel booking'),
    debit('txn_c_h2', u, prepaid, 'Raffles Medical', 'Health', 55, '2026-04-16T10:00:00', 'Clinic visit'),
  ];
}

function adamTransactions() {
  const u = 'user_4';
  const prepaid = 'card_prepaid_4';
  const linked = 'card_dbs_4';

  return [
    monthlyPayroll('txn_d_j1', u, linked, 3800, '2026-06'),
    ...monthlyPrepaidLoad('txn_d_j1tu', u, linked, prepaid, 100, '2026-06'),
    debit('txn_d_j2', u, prepaid, 'LiHO Tea', 'Drinks', 6.8, '2026-06-02T13:10:00'),
    debit('txn_d_j3', u, prepaid, 'Toast Box', 'Dining', 6.5, '2026-06-03T08:40:00'),
    debit('txn_d_j4', u, prepaid, 'Gong Cha', 'Drinks', 7.5, '2026-06-04T16:20:00'),
    debit('txn_d_j5', u, prepaid, 'Grab', 'Transport', 13.2, '2026-06-05T19:00:00', 'Ride-hail payment'),
    debit('txn_d_j6', u, prepaid, 'Pizza Hut', 'Dining', 26.4, '2026-06-06T19:45:00'),
    debit('txn_d_j7', u, linked, 'Uniqlo Orchard', 'Retail', 45.9, '2026-06-07T15:30:00'),
    debit('txn_d_j8', u, prepaid, 'Boost Juice', 'Drinks', 8.9, '2026-06-08T12:15:00'),
    debit('txn_d_j9', u, prepaid, 'NTUC FairPrice', 'Groceries', 18.6, '2026-06-09T18:30:00'),
    debit('txn_d_j10', u, prepaid, 'Mr Bean', 'Drinks', 4.5, '2026-06-10T09:00:00'),
    debit('txn_d_j11', u, linked, 'Decathlon Singapore', 'Retail', 59.9, '2026-06-12T14:00:00'),
    debit('txn_d_j12', u, prepaid, 'Marina Bay Hawker', 'Dining', 9.8, '2026-06-14T12:30:00'),
    debit('txn_d_j13', u, prepaid, 'Watsons', 'Retail', 15.9, '2026-06-16T17:20:00'),
    debit('txn_d_j14', u, prepaid, 'SimplyGo Transit', 'Transport', 1.82, '2026-06-18T08:15:00', 'MRT / bus fare'),

    monthlyPayroll('txn_d_m1', u, linked, 3800, '2026-05'),
    ...monthlyPrepaidLoad('txn_d_m1tu', u, linked, prepaid, 90, '2026-05'),
    debit('txn_d_m2', u, prepaid, 'Killiney Kopitiam', 'Dining', 6.5, '2026-05-04T08:20:00'),
    debit('txn_d_m3', u, prepaid, 'Cold Storage', 'Groceries', 34.8, '2026-05-06T19:00:00'),
    debit('txn_d_m4', u, linked, 'H&M VivoCity', 'Retail', 38.2, '2026-05-08T16:45:00'),
    debit('txn_d_m5', u, prepaid, 'Starbucks One Raffles', 'Coffee', 9.2, '2026-05-10T09:30:00'),
    debit('txn_d_m6', u, prepaid, 'Grab', 'Transport', 11.8, '2026-05-12T18:10:00', 'Ride-hail payment'),
    debit('txn_d_m7', u, prepaid, 'Guardian Pharmacy', 'Retail', 18.5, '2026-05-15T13:00:00'),
    debit('txn_d_m8', u, prepaid, 'Dough Culture', 'Dining', 12.8, '2026-05-18T12:00:00'),

    ...monthlyPrepaidLoad('txn_d_f0tu', u, linked, prepaid, 85, '2026-02'),
    ...monthlyPrepaidLoad('txn_d_g0tu', u, linked, prepaid, 85, '2026-03'),
    ...monthlyPrepaidLoad('txn_d_h0tu', u, linked, prepaid, 85, '2026-04'),
    debit('txn_d_f1', u, prepaid, 'Cotton On', 'Retail', 29.9, '2026-02-12T15:00:00'),
    debit('txn_d_g1', u, prepaid, 'Ichiban Sushi', 'Dining', 32.5, '2026-03-16T19:00:00'),
    debit('txn_d_h1', u, linked, 'Muji Orchard', 'Retail', 34.5, '2026-04-09T14:30:00'),
  ];
}

function buildAllTransactions() {
  return [
    ...alexTransactions(),
    ...sarahTransactions(),
    ...chengTransactions(),
    ...adamTransactions(),
  ].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
}

module.exports = {
  buildAllTransactions,
};
