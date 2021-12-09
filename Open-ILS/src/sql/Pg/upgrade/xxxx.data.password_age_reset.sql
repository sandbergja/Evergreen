BEGIN;

--SELECT evergreen.upgrade_deps_block_check('XXXX', :eg_version);

-- password age display setting

INSERT INTO config.org_unit_setting_type
    (name, grp, label, description, datatype)
    VALUES (
        'auth.password_expire_age',
        'sec',
        oils_i18n_gettext(
            'auth.password_expire_age',
            'Password Reset Age',
            'coust',
            'label'
        ),
        oils_i18n_gettext(
            'auth.password_expire_age',
            'The number of days after a password has been changed before ' || 
			'users will be alerted that they should update it.',
            'coust',
            'description'
        ),
        'integer'
    );

INSERT INTO action_trigger.hook (key,core_type,description,passive) VALUES (
    'aupsd.passwd_changed',
    'aupsd',
    oils_i18n_gettext(
        'au.passwd_changed',
        'An account password was updated',
        'ath',
        'description'
    ),
	true
);

-- Sample Password Update Notice --

INSERT INTO action_trigger.event_definition (active, owner, name, delay_field, delay, max_delay, repeat_delay, hook, validator, reactor,  template) 
    VALUES ('f', 1, 'Password Update Notice', 'edit_date','90 days', '91 days','90 days' 'aupsd.passwd_changed', 'NOOP_True', 'SendEmail',
$$
[%- USE date -%]
[%- user = target.usr -%]
To: [%- params.recipient_email || user.email %]
From: [%- params.sender_email || default_sender || helpers.get_org_setting(user.home_ou, 'org.bounced_emails') %]
Date: [%- date.format(date.now, '%a, %d %b %Y %T -0000', gmt => 1) %]
Subject: Password Update Required
Auto-Submitted: auto-generated

Dear [% user.family_name %], [% user.first_given_name %]
Regularly updating your password is an essential part of maintaining the security of your account. At the time of writing, your password is 90 days old. Please log in to the system or contact a system administrator to update your password. 

$$);

INSERT INTO action_trigger.environment (
    event_def,
    path
) VALUES (
    currval('action_trigger.event_definition_id_seq'),
    'usr'
);
--ROLLBACK;
COMMIT;