#!perl

use strict; use warnings;
use Test::More tests => 2;
use Template;
use FindBin qw($Bin);
use Carp;
use OpenILS::WWW::EGWeb;

my $config = {
    INCLUDE_PATH => "$Bin/../../templates-bootstrap",
};
my $tt = Template->new($config);
my $output;
my %vars = (
    ctx => {
        copy_summary => {
            size => 2,
	    0 => {available => 1, count => 2, org_unit => 103},
	    1 => {available => 5, count => 6, org_unit => 7},
        },
	get_aou => sub { 
            return shift == 103 ?
	        {name =>'Albright Memorial Library', opac_visible => 't'} :
		{name => 'Lackawanna County Library System', opac_visible => 't' }
	},
	org_hiding_disabled => sub { return 1; },
    },
    l => sub { return OpenILS::WWW::EGWeb::I18N->new->maketext(@_) }
);

$tt->process(
    "opac/parts/record/copy_counts.tt2",
    \%vars,
    \$output
) or croak $tt->error;

like $output, qr/1 of 2 copies available at Albright Memorial Library/, "contains copy counts for library";
like $output, qr/5 of 6 copies available at Lackawanna County Library System/, "contains copy counts for system";

