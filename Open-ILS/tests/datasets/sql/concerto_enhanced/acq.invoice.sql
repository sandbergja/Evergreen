COPY acq.invoice (id, receiver, provider, shipper, recv_date, recv_method, inv_type, inv_ident, payment_auth, payment_method, note, close_date, closed_by) FROM stdin;
1	107	1	1	2022-06-16 23:00:00-05	PPR	\N	B1234512	\N	\N	\N	2022-06-17 10:49:46-05	1
2	107	1	1	2022-06-16 23:00:00-05	PPR	\N	B45612222	\N	\N	\N	\N	\N
3	4	5	5	2022-06-16 23:00:00-05	PPR	\N	12345678	\N	\N	\N	2022-06-17 11:01:59-05	1
4	4	5	5	2022-06-16 23:00:00-05	PPR	\N	B8887771	\N	\N	\N	\N	\N
\.

\echo sequence update column: id
SELECT SETVAL('acq.invoice_id_seq', (SELECT MAX(id) FROM acq.invoice));
