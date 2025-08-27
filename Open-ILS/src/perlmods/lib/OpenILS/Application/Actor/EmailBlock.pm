package OpenILS::Application::Actor::EmailBlock;
use base 'OpenILS::Application';
use strict; use warnings;

use OpenILS::Utils::Fieldmapper;
use OpenILS::Utils::CStoreEditor qw/:funcs/;

__PACKAGE__->register_method (
    method      => 'block_email',
    api_name    => 'open-ils.actor.block_email',
    signature => {
        desc => "Adds a specific email address to the block list",
        params => [
            {desc => 'Authentication token', type => 'string'},
            {desc => 'email address', type => 'string'},
        ],
        return => {desc => '1 on success, Event on error'}
    }
);

__PACKAGE__->register_method (
    method      => 'block_email',
    api_name    => 'open-ils.actor.block_email_domain',
    signature => {
        desc => "Adds the domain or subdomain of the provided email address to the block list",
        params => [
            {desc => 'Authentication token', type => 'string'},
            {desc => 'email address', type => 'string'},
        ],
        return => {desc => '1 on success, Event on error'}
    }
);

sub block_email {
    my($self, $conn, $auth, $email) = @_;

    my $e = new_editor(authtoken => $auth, xact => 1);
    return $e->event unless $e->checkauth;
    return $e->event unless $e->allowed('BLOCK_EMAIL') || $e->allowed('ADMIN_SPAM');

    my $block_entry = Fieldmapper::permission::email_block_list->new;

    if ($self->api_name =~ /email_domain/) {
        my ($_local_part, $domain) = split '@', $email;
        return OpenILS::Event->new('BAD_PARAMS') unless $domain;

        $block_entry->type('domain');
        $block_entry->address($domain);
    } else {
        $block_entry->type('email');
        $block_entry->address($email);
    }
    if ($e->create_permission_email_block_list($block_entry)) {
        $e->xact_commit || return $e->event;
        return 1;
    }
    return OpenILS::Event->new('NO_CHANGE');
}

1;
