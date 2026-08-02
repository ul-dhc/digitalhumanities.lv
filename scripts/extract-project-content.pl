use strict;
use warnings;
use utf8;
use HTML::TreeBuilder;
use JSON::PP;
use File::Spec;
use File::Basename qw(fileparse);
use File::Copy qw(copy);
use File::Path qw(make_path);
use File::Glob qw(bsd_glob);
use HTML::Entities qw(decode_entities);

binmode STDOUT, ':encoding(UTF-8)';

my ($source_root, $output_file, $preservation_root, $public_root) = @ARGV;
die "Usage: $0 SOURCE_ROOT OUTPUT_FILE [PRESERVATION_ROOT PUBLIC_ROOT]\n" unless $source_root && $output_file;

my @sources = (
  [lv => 'digilate', 'projekti/digilate/index.html'],
  [lv => 'vti', 'projekti/vti/index.html'],
  [lv => 'dheli', 'projekti/DHELI/index.html'],
  [lv => 'dh-vpp', 'projekti/DHVPP/index.html'],
  [lv => 'late', 'projekti/vpp-late/index.html'],
  [lv => 'teiktas-dziesmas', 'projekti/teiktas-dziesmas/index.html'],
  [lv => 'lu-open', 'projekti/lu-open/index.html'],
  [en => 'digilate', 'projects/digilate/index.html'],
  [en => 'vti', 'projects/the-language-technology-initiative/index.html'],
  [en => 'dheli', 'projects/DHELI-en/index.html'],
  [en => 'dh-vpp', 'projects/DHVPP-en/index.html'],
  [en => 'late', 'projects/vpp-late/index.html'],
  [en => 'teiktas-dziesmas', 'projects/spoken-songs/index.html'],
  [en => 'going-beyond-search', 'projects/going-beyond-search-nordplus/index.html'],
);

my %result;
for my $source (@sources) {
  my ($lang, $slug, $relative) = @$source;
  my $path = File::Spec->catfile($source_root, split('/', $relative));
  next unless -f $path;
  open my $fh, '<:encoding(UTF-8)', $path or die "Cannot open $path: $!";
  local $/;
  my $html = <$fh>;
  close $fh;
  next unless $html =~ m{<main\b[^>]*>(.*?)</main>}si;

  my $tree = HTML::TreeBuilder->new;
  $tree->parse("<html><body>$1</body></html>");
  my @blocks;
  my $skipped_title = 0;
  my $image_index = 0;
  for my $element ($tree->look_down(sub {
    return 1 if $_[0]->tag =~ /^(h1|h2|h3|p|li|img|span|i)$/;
    return $_[0]->tag eq 'div' && (($_[0]->attr('class') || '') =~ /\bmoze-justify\b/);
  })) {
    my $tag = $element->tag;
    if ($tag eq 'p') {
      my $parent = $element->parent;
      next if $parent && $parent->tag eq 'li';
    }
    if ($tag eq 'img') {
      my $src = $element->attr('src') || '';
      next unless $src =~ m{^https?://};
      next if $lang eq 'lv' && $slug eq 'lu-open' && $src =~ /IMG_0625\.jpg/i;
      my $alt = $element->attr('alt') || '';
      $alt =~ s/\s+/ /g;
      if ($preservation_root && $public_root && $src =~ m{^https?://([^/]+)/([^?]+)(?:\?.*)?$}) {
        my ($host, $url_path) = ($1, $2);
        my $local_source = File::Spec->catfile($preservation_root, 'remote-assets', $host, split('/', $url_path));
        if (!-f $local_source) {
          my ($base, $dir, $ext) = fileparse($local_source, qr/\.[^.]*/);
          my @variants = bsd_glob(File::Spec->catfile($dir, $base . '__q-*' . $ext));
          $local_source = $variants[0] if @variants;
        }
        if (-f $local_source) {
          my ($name, undef, $suffix) = fileparse($local_source, qr/\.[^.]*/);
          $suffix = '.jpg' unless $suffix =~ /^\.(?:png|jpe?g|webp|gif|svg)$/i;
          my $asset_dir = File::Spec->catdir($public_root, 'assets', 'project-details', $lang, $slug);
          make_path($asset_dir);
          my $asset_name = sprintf('%02d%s', ++$image_index, lc $suffix);
          copy($local_source, File::Spec->catfile($asset_dir, $asset_name)) or die "Cannot copy $local_source: $!";
          $src = "/assets/project-details/$lang/$slug/$asset_name";
        }
      }
      push @blocks, { tag => 'img', src => $src, alt => $alt };
      next;
    }
    if ($tag eq 'div') {
      my $ancestor = $element->parent;
      my $nested_in_block = 0;
      while ($ancestor) {
        my $ancestor_is_content_div = $ancestor->tag eq 'div' && (($ancestor->attr('class') || '') =~ /\bmoze-justify\b/);
        if ($ancestor->tag =~ /^(?:h1|h2|h3|p|li|span|i)$/ || $ancestor_is_content_div) { $nested_in_block = 1; last; }
        $ancestor = $ancestor->parent;
      }
      next if $nested_in_block;
      next if $element->look_down(sub {
        return 0 if $_[0] == $element;
        return 1 if $_[0]->tag =~ /^(?:h1|h2|h3|p|li)$/;
        return $_[0]->tag eq 'div' && (($_[0]->attr('class') || '') =~ /\bmoze-justify\b/);
      });
      $tag = 'p';
    }
    if ($tag eq 'span' || $tag eq 'i') {
      my $ancestor = $element->parent;
      my $nested_in_block = 0;
      while ($ancestor) {
        my $ancestor_is_content_div = $ancestor->tag eq 'div' && (($ancestor->attr('class') || '') =~ /\bmoze-justify\b/);
        if ($ancestor->tag =~ /^(?:h1|h2|h3|p|li|span|i)$/ || $ancestor_is_content_div) { $nested_in_block = 1; last; }
        $ancestor = $ancestor->parent;
      }
      next if $nested_in_block;
      next if $element->look_down(sub { $_[0] != $element && $_[0]->tag =~ /^(?:h1|h2|h3|p|li)$/ });
      $tag = 'p';
    }
    my $text = $element->as_HTML('<>&', '');
    $text =~ s{<br\b[^>]*>}{\n}gi;
    $text =~ s{<[^>]+>}{}g;
    $text = decode_entities($text);
    $text =~ s/[\x{00A0}\x{FFFD}]+/ /g;
    $text =~ s/[^\S\r\n]+/ /g;
    $text =~ s/ *\n */\n/g;
    $text =~ s/\n{2,}/\n/g;
    $text =~ s/^\s+|\s+$//g;
    next if length($text) < 2;
    if (!$skipped_title && $tag =~ /^h[12]$/) { $skipped_title = 1; next; }
    my @links;
    for my $link ($element->look_down(_tag => 'a')) {
      my $url = $link->attr('href') || '';
      my $label = $link->as_text || '';
      $label =~ s/\s+/ /g;
      next unless $url =~ m{^(?:https?://|mailto:)};
      push @links, { text => $label || $url, url => $url };
    }
    push @blocks, { tag => $tag, text => $text, (@links ? (links => \@links) : ()) };
  }
  $tree->delete;

  # A few project pages used Mozello's editable footer as a project-specific logo strip.
  my $full_tree = HTML::TreeBuilder->new;
  $full_tree->parse($html);
  my $foottext = $full_tree->look_down(id => 'foottext');
  my @footer_images = $foottext ? $foottext->look_down(_tag => 'img') : ();
  if (@footer_images) {
    push @blocks, { tag => 'h2', text => ($lang eq 'lv' ? 'Projekta institūcijas' : 'Project institutions') };
    for my $element (@footer_images) {
      my $src = $element->attr('src') || '';
      next unless $src =~ m{^https?://};
      next if $lang eq 'lv' && $slug eq 'lu-open' && $src =~ /csm_LU_Libiesu_instituts_logo/i;
      if ($lang eq 'lv' && $slug eq 'lu-open' && $src =~ /lu_hzf-removebg-preview/i) {
        push @blocks, { tag => 'img', src => '/assets/project-details/shared/hzf-lat.png', alt => 'Latvijas Universitātes Humanitāro zinātņu fakultāte' };
        next;
      }
      my $alt = $element->attr('alt') || '';
      if ($preservation_root && $public_root && $src =~ m{^https?://([^/]+)/([^?]+)(?:\?.*)?$}) {
        my ($host, $url_path) = ($1, $2);
        my $local_source = File::Spec->catfile($preservation_root, 'remote-assets', $host, split('/', $url_path));
        if (!-f $local_source) {
          my ($base, $dir, $ext) = fileparse($local_source, qr/\.[^.]*/);
          my @variants = bsd_glob(File::Spec->catfile($dir, $base . '__q-*' . $ext));
          $local_source = $variants[0] if @variants;
        }
        if (-f $local_source) {
          my ($name, undef, $suffix) = fileparse($local_source, qr/\.[^.]*/);
          $suffix = '.jpg' unless $suffix =~ /^\.(?:png|jpe?g|webp|gif|svg)$/i;
          my $asset_dir = File::Spec->catdir($public_root, 'assets', 'project-details', $lang, $slug);
          make_path($asset_dir);
          my $asset_name = sprintf('%02d%s', ++$image_index, lc $suffix);
          copy($local_source, File::Spec->catfile($asset_dir, $asset_name)) or die "Cannot copy $local_source: $!";
          $src = "/assets/project-details/$lang/$slug/$asset_name";
        }
      }
      push @blocks, { tag => 'img', src => $src, alt => $alt };
    }
  }
  $full_tree->delete;

  for (my $i = 0; $i < @blocks - 1; $i++) {
    if (($blocks[$i]{text} || '') eq 'Ȭ' && ($blocks[$i + 1]{text} || '') =~ /^PEN\b/) {
      $blocks[$i + 1]{text} = 'Ȭ' . $blocks[$i + 1]{text};
      splice @blocks, $i, 1;
      last;
    }
  }
  if ($lang eq 'lv' && $slug eq 'lu-open') {
    for my $block (@blocks) {
      if (($block->{text} || '') =~ /^PEN projekts\b/) {
        $block->{text} = 'Ȭ' . $block->{text};
        last;
      }
    }
  }
  if ($lang eq 'lv' && $slug eq 'dheli') {
    for my $block (@blocks) {
      if (($block->{text} || '') =~ /Kontaktinformācija:.*Projekta vadītāja:/s) {
        $block->{text} = "Projekta vadītāji:\nSanita Reinsone (2022–2024)\nSandis Laime (2024–2025)";
        delete $block->{links};
      }
    }
  }
  $result{"$lang/$slug"} = \@blocks;
}

open my $out, '>:encoding(UTF-8)', $output_file or die "Cannot write $output_file: $!";
print {$out} JSON::PP->new->utf8(0)->canonical(1)->pretty(1)->encode(\%result);
close $out;
