
use 5.012;

use AnyEvent;

use Time::HiRes qw(gettimeofday tv_interval);

my $cv = AnyEvent->condvar;

my $t0 = [gettimeofday];

my $manager = Task::HTTP::Client::Manager->new (
	max_conn => 5,
	cv       => $cv
);

$::quiet = 1;

for (1..10000) {
	say "client $_ created" unless $::quiet;
	my $client = Task::HTTP::Client->new (
		manager => $manager,
		id      => $_
	);

	$client->fetch ("http://127.0.0.1:50088/");
}

$cv->recv;

my $elapsed = tv_interval ($t0);

warn "done in $elapsed";

# http_get "http://127.0.0.1/", sub { print $_[1] };

# manager handles respource allocation
package Task::HTTP::Client::Manager;

use 5.012;

use base qw(Object::Event);

use AnyEvent::HTTP;

sub add {
	my $self = shift;
	my $url  = shift;
	my $id   = shift;
	my $cb   = shift;

	$self->{waiting} = []
		unless exists $self->{waiting};
	
	say "client $id added" unless $::quiet;

	push @{$self->{waiting}}, [$url, $id, $cb];

	$self->run;
}

sub run {
	my $self = shift;

	$self->{idle} = 1
		unless exists $self->{idle};
	
	while ($self->{running} < $self->{max_conn}) {
		my $client_conf = shift @{$self->{waiting}};
		last
			unless defined $client_conf;
		$self->{running}++;
		
		say "client $client_conf->[1] started" unless $::quiet;
		
		http_get ($client_conf->[0], sub {
			my $content = shift;
			my $headers = shift;
			
			$self->client_done ($client_conf->[1], $content, $headers);
		});
	}
}

sub client_done {
	my $self = shift;
	my $id   = shift;

	say "client $id done ($self->{running} remains running)" unless $::quiet;
	
	$self->{running}--;
	$self->run;

	unless ($self->{running}) {
		$self->{cv}->send;	
	}

}

1;

package Task::HTTP::Client;

use base qw(Object::Event);

sub fetch {
	my $self = shift;
	my $url  = shift;

	$self->{manager}->add ($url, $self->{id}, sub {
		my $err      = shift;
		my $response = shift;
		# nothing here at this time
	});
}

1;
