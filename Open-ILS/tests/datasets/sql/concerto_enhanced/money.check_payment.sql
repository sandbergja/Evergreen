COPY money.check_payment (id, xact, payment_ts, voided, amount, note, amount_collected, accepting_usr, cash_drawer, check_number) FROM stdin;
20	526	2022-06-17 16:05:04.906701-05	0	5.95		5.95	1	24	12345
28	532	2022-06-17 16:08:32.482411-05	0	10.00		10.00	1	24	4465
47	508	2022-06-17 16:25:20.170547-05	0	10.00	Room reservation fee - non-refundable	10.00	1	24	234
\.

