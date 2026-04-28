<?php

/**
 * Logo upload validator + persister for the admin brand settings.
 *
 * Extracted from `AdminFrakIntegrationController::processBrandFields()` so the
 * file-validation rules (extension allowlist, size cap) and the URL-locality
 * check live in one i18n-agnostic class. The controller maps the returned
 * error codes to translated messages — keeps this helper unit-testable
 * without bootstrapping PrestaShop's translation layer.
 *
 * Files land in `_PS_MODULE_DIR_ . 'frakintegration/uploads/'`. The directory
 * is gitignored (only `.htaccess` is tracked), so the staging mkdir() is the
 * single point of truth for runtime creation. The `.htaccess` blocks PHP
 * execution in the directory regardless of upload validation — defense in
 * depth against any future bypass of the extension allowlist.
 */
class FrakLogoUploader
{
    /**
     * Allowed logo file extensions. Mirrors the legacy module's contract.
     *
     * @var string[]
     */
    public const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'svg'];

    /** Maximum logo file size in bytes (2 MB). */
    public const MAX_FILE_SIZE = 2 * 1024 * 1024;

    /**
     * Per-extension MIME allowlist for raster images. The uploaded file's
     * libmagic-detected content type must match the value listed here for the
     * extension to be accepted. SVG is validated separately via a prefix
     * sniff because libmagic's SVG classification is unstable across
     * versions — see {@see looksLikeSvg()}.
     *
     * @var array<string, string>
     */
    private const RASTER_MIME_TYPES = [
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
    ];

    public const ERROR_INVALID_FORMAT = 'invalid_format';
    public const ERROR_TOO_LARGE = 'too_large';
    public const ERROR_MOVE_FAILED = 'move_failed';
    public const ERROR_MIME_MISMATCH = 'mime_mismatch';

    /** Filesystem path to the uploads dir (with trailing slash). */
    private const UPLOAD_SUBDIR = 'frakintegration/uploads/';

    /** Public URL fragment to the uploads dir (relative to the shop base URL). */
    private const UPLOAD_URL_FRAGMENT = 'modules/frakintegration/uploads/';

    /**
     * Validate and persist an uploaded logo file. Returns a result map with
     * either a `url` (success) or an `error` code (failure). Error codes are
     * stable strings — the caller maps them to translated messages.
     *
     * `move_uploaded_file()` is the only fs-mutating call; everything before
     * it is a pure check, so a rejected upload never touches the filesystem.
     *
     * @param array{name:string,tmp_name:string,error:int,size:int} $file    The `$_FILES['FRAK_LOGO_FILE']` entry.
     * @param string                                                $baseUrl Shop base URL (trailing slash included).
     * @return array{url?: string, error?: string}
     */
    public static function processUpload(array $file, string $baseUrl): array
    {
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($extension, self::ALLOWED_EXTENSIONS, true)) {
            return ['error' => self::ERROR_INVALID_FORMAT];
        }
        if ((int) $file['size'] > self::MAX_FILE_SIZE) {
            return ['error' => self::ERROR_TOO_LARGE];
        }
        if (!self::contentMatchesExtension((string) $file['tmp_name'], $extension)) {
            // Catches `evil.php` renamed `evil.jpg` with a spoofed Content-Type
            // header — the extension allowlist alone trusts the filename, so
            // libmagic / a SVG prefix sniff is the second gate before the file
            // is moved into the public uploads dir.
            return ['error' => self::ERROR_MIME_MISMATCH];
        }

        $uploadsDir = _PS_MODULE_DIR_ . self::UPLOAD_SUBDIR;
        if (!is_dir($uploadsDir)) {
            // Recursive mkdir matches the legacy controller's behaviour for
            // shops where the dir was deleted post-install (gitignored, only
            // `.htaccess` tracked — a fresh checkout would have no dir).
            mkdir($uploadsDir, 0755, true);
        }

        $filename = 'logo_' . uniqid() . '.' . $extension;
        $targetPath = $uploadsDir . $filename;

        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            return ['error' => self::ERROR_MOVE_FAILED];
        }

        return ['url' => $baseUrl . self::UPLOAD_URL_FRAGMENT . $filename];
    }

    /**
     * Verify the uploaded file's actual content matches its declared
     * extension. Two strategies because libmagic's SVG classification is
     * unstable across versions (sometimes `image/svg+xml`, sometimes
     * `text/xml`, sometimes `text/html` for prologue-less files):
     *
     *   - Raster images (jpg / jpeg / png / gif): libmagic must return the
     *     expected `image/*` MIME type. Spoofing requires forging the
     *     binary header, which is not trivial and — more importantly — a
     *     valid raster header is not also valid PHP / HTML.
     *   - SVG: prefix sniff. The first non-whitespace bytes must be either
     *     an `<?xml` prologue or a `<svg` root tag. PHP / HTML smuggled
     *     under a `.svg` extension fails this check because their first
     *     tokens are `<?php` / `<!doctype` / `<html`.
     *
     * Returns `false` (rejecting the upload) when the source file is
     * unreadable — stricter than "unknown so allow", and consistent with the
     * surrounding deny-by-default upload validation contract.
     */
    private static function contentMatchesExtension(string $path, string $extension): bool
    {
        if ($extension === 'svg') {
            return self::looksLikeSvg($path);
        }
        $expected = self::RASTER_MIME_TYPES[$extension] ?? null;
        if ($expected === null) {
            return false;
        }
        if (!function_exists('finfo_open')) {
            // libmagic is shipped with PHP since 5.3 and enabled by default,
            // but defense-in-depth: deny the upload if it is somehow absent
            // rather than silently skipping the gate.
            return false;
        }
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo === false) {
            return false;
        }
        $detected = finfo_file($finfo, $path);
        // PHP 8.5 deprecated `finfo_close()` (the finfo object is freed
        // automatically when it goes out of scope); since 8.1 keeps the call
        // working we just rely on the destructor here for forward compat.
        return is_string($detected) && strtolower($detected) === $expected;
    }

    /**
     * SVG content sniff: first non-whitespace bytes must be `<?xml` or
     * `<svg`. Reads only the first 512 bytes — enough to catch the prologue
     * / root element and short-circuits long binaries that happen to share
     * a `.svg` extension.
     */
    private static function looksLikeSvg(string $path): bool
    {
        $head = @file_get_contents($path, false, null, 0, 512);
        if (!is_string($head) || $head === '') {
            return false;
        }
        $head = ltrim($head);
        if ($head === '') {
            return false;
        }
        return strncmp($head, '<?xml', 5) === 0
            || strncasecmp($head, '<svg', 4) === 0;
    }

    /**
     * Verify that a URL points to a previously-uploaded logo file inside our
     * uploads directory. Used by the brand-fields validator to accept a
     * just-uploaded URL that does not pass `Validate::isUrl()` because it
     * was constructed from `$context->link->getBaseLink()` (which can omit
     * the protocol on some configurations).
     *
     * Two-step check: prefix match on the URL plus `file_exists()` on the
     * resolved filename — prevents a crafted URL from passing the gate when
     * the underlying file is absent.
     */
    public static function isLocalUrl(string $url, string $baseUrl): bool
    {
        $modulePrefix = $baseUrl . self::UPLOAD_URL_FRAGMENT;
        if (strpos($url, $modulePrefix) !== 0) {
            return false;
        }
        $filename = basename($url);
        return file_exists(_PS_MODULE_DIR_ . self::UPLOAD_SUBDIR . $filename);
    }
}
