<?php

/**
 * Swaps `{frak_*}` markers in a CMS page's content for their component.
 *
 * CMS content is printed `nofilter` and never compiled by Smarty, and the
 * HTML cleaner strips raw `<frak-*>` tags, so the markers are plain text that
 * is replaced at display time through the chained `filterCmsContent` hook.
 */
class FrakCmsMarkers
{
    /** @var array<string, string> Marker name => renderer method. */
    private const COMPONENTS = [
        'ambassador' => 'ambassador',
        'banner' => 'banner',
        'share_button' => 'shareButton',
        'post_purchase' => 'postPurchase',
    ];

    /** Whitespace as the editor may leave it, including entity-encoded nbsp. */
    private const SPACE = '(?:\s|&nbsp;|&#0?160;|\x{00A0})';

    /** A quoted value as stored after the cleaner: raw quotes or their entities. */
    private const VALUE = '(?|"([^"<]*)"|\'([^\'<]*)\'|&quot;((?:(?!&quot;)[^<])*)&quot;|&#0?39;((?:(?!&#0?39;)[^<])*)&#0?39;)';

    /**
     * Return the hook args with `object.content` swapped. The hook is
     * chained, so the whole args array must come back, never a string.
     *
     * @param array<string, mixed> $params Args of `filterCmsContent`.
     * @return array<string, mixed>
     */
    public static function filterArgs(array $params): array
    {
        $content = $params['object']['content'] ?? null;
        if (is_string($content)) {
            $params['object']['content'] = self::replace($content);
        }

        return $params;
    }

    /** Replace every parseable marker; a marker alone in a `<p>` replaces the paragraph. */
    public static function replace(string $content): string
    {
        if (!str_contains($content, '{frak_')) {
            return $content;
        }

        $names = implode('|', array_keys(self::COMPONENTS));
        $attr = self::SPACE . '+[A-Za-z_][A-Za-z0-9_]*=' . self::VALUE;
        $marker = '\{frak_(' . $names . ')((?:' . $attr . ')*)' . self::SPACE . '*\}';
        $paragraph = '<p(?:\s[^>]*)?>' . self::SPACE . '*' . $marker . self::SPACE . '*<\/p>';

        foreach ([$paragraph, $marker] as $pattern) {
            if (!str_contains($content, '{frak_')) {
                break;
            }
            $content = (string) preg_replace_callback(
                '/' . $pattern . '/u',
                static fn (array $m): string => self::render($m[1], $m[2]),
                $content
            );
        }

        return $content;
    }

    /** Render one marker; attributes go through the same maps as the Smarty tags. */
    private static function render(string $name, string $rawAttrs): string
    {
        $attrs = [];
        $pattern = '/([A-Za-z_][A-Za-z0-9_]*)=' . self::VALUE . '/u';
        if (preg_match_all($pattern, $rawAttrs, $found, PREG_SET_ORDER)) {
            foreach ($found as $pair) {
                $attrs[$pair[1]] = html_entity_decode($pair[2], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            }
        }

        return FrakComponentRenderer::{self::COMPONENTS[$name]}(
            FrakComponentRenderer::snakeKeysToCamel($attrs)
        );
    }
}
