<?php

declare(strict_types=1);

namespace FrakLabs\PrestaShop\Test\Unit;

use FrakLogoUploader;
use PHPUnit\Framework\TestCase;

if (!defined('_PS_MODULE_DIR_')) {
    define('_PS_MODULE_DIR_', sys_get_temp_dir() . '/');
}

require_once __DIR__ . '/../../classes/FrakLogoUploader.php';

/**
 * Pure-PHP coverage for the upload validation contract. The `move_uploaded_file()`
 * happy path requires a real PHP file-upload context (only valid inside SAPIs that
 * processed an HTTP POST with multipart/form-data) and is left to integration
 * tests — but every rejection path is exercised here without touching the
 * filesystem, which is exactly the point of having extracted the helper out of
 * the controller.
 */
final class FrakLogoUploaderTest extends TestCase
{
    public function testRejectsExtensionOutsideAllowlist(): void
    {
        $result = FrakLogoUploader::processUpload(
            ['name' => 'malicious.php', 'tmp_name' => '/tmp/x', 'error' => 0, 'size' => 100],
            'https://shop.example.com/'
        );

        $this->assertSame(['error' => FrakLogoUploader::ERROR_INVALID_FORMAT], $result);
    }

    public function testRejectsOversizeFile(): void
    {
        $result = FrakLogoUploader::processUpload(
            [
                'name' => 'logo.png',
                'tmp_name' => '/tmp/x',
                'error' => 0,
                // 1 byte over the 2 MB cap.
                'size' => FrakLogoUploader::MAX_FILE_SIZE + 1,
            ],
            'https://shop.example.com/'
        );

        $this->assertSame(['error' => FrakLogoUploader::ERROR_TOO_LARGE], $result);
    }

    public function testExtensionCheckIsCaseInsensitive(): void
    {
        // `.PNG` and `.JPG` come out of OS file pickers on Windows / older macOS
        // — the helper lowercases the extension before the allowlist check so
        // these are accepted and forwarded to the MIME gate. We supply a real
        // PNG signature so the MIME gate passes and the upload reaches
        // `move_uploaded_file()` (which fails outside a real upload context,
        // producing ERROR_MOVE_FAILED — our sentinel for "validator passed").
        $tmpPath = (string) tempnam(sys_get_temp_dir(), 'frak-test-');
        file_put_contents($tmpPath, self::pngFixture());

        try {
            $result = FrakLogoUploader::processUpload(
                [
                    'name' => 'logo.PNG',
                    'tmp_name' => $tmpPath,
                    'error' => 0,
                    'size' => 100,
                ],
                'https://shop.example.com/'
            );

            $this->assertArrayHasKey('error', $result);
            $this->assertSame(FrakLogoUploader::ERROR_MOVE_FAILED, $result['error']);
        } finally {
            @unlink($tmpPath);
        }
    }

    public function testRejectsExtensionMismatchedContent(): void
    {
        // `evil.php` renamed `evil.jpg` smuggles PHP through the extension
        // allowlist; libmagic catches it because the actual content is
        // `text/x-php`, not `image/jpeg`. Without this gate, an attacker who
        // controlled a multipart upload could place an executable file inside
        // the public uploads dir.
        $tmpPath = (string) tempnam(sys_get_temp_dir(), 'frak-test-');
        file_put_contents($tmpPath, '<?php echo "pwned"; ?>');

        try {
            $result = FrakLogoUploader::processUpload(
                [
                    'name' => 'evil.jpg',
                    'tmp_name' => $tmpPath,
                    'error' => 0,
                    'size' => 22,
                ],
                'https://shop.example.com/'
            );

            $this->assertSame(['error' => FrakLogoUploader::ERROR_MIME_MISMATCH], $result);
        } finally {
            @unlink($tmpPath);
        }
    }

    public function testAcceptsValidPngContent(): void
    {
        // A real PNG file flows past the MIME gate and reaches the move —
        // ERROR_MOVE_FAILED here means the validator approved the file.
        $tmpPath = (string) tempnam(sys_get_temp_dir(), 'frak-test-');
        file_put_contents($tmpPath, self::pngFixture());

        try {
            $result = FrakLogoUploader::processUpload(
                [
                    'name' => 'logo.png',
                    'tmp_name' => $tmpPath,
                    'error' => 0,
                    'size' => 100,
                ],
                'https://shop.example.com/'
            );

            $this->assertSame(['error' => FrakLogoUploader::ERROR_MOVE_FAILED], $result);
        } finally {
            @unlink($tmpPath);
        }
    }

    public function testAcceptsSvgWithXmlPrologue(): void
    {
        // SVG with the canonical `<?xml` prologue passes the prefix sniff
        // (libmagic's classification of SVG is too unstable to rely on, so we
        // sniff the first non-whitespace bytes ourselves).
        $svg = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>';
        $tmpPath = (string) tempnam(sys_get_temp_dir(), 'frak-test-');
        file_put_contents($tmpPath, $svg);

        try {
            $result = FrakLogoUploader::processUpload(
                [
                    'name' => 'logo.svg',
                    'tmp_name' => $tmpPath,
                    'error' => 0,
                    'size' => strlen($svg),
                ],
                'https://shop.example.com/'
            );

            $this->assertSame(['error' => FrakLogoUploader::ERROR_MOVE_FAILED], $result);
        } finally {
            @unlink($tmpPath);
        }
    }

    public function testAcceptsBareSvgRoot(): void
    {
        // Prologue-less SVG (just `<svg ...>`) is also accepted — many design
        // tools omit the XML declaration when exporting compact assets.
        $svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
        $tmpPath = (string) tempnam(sys_get_temp_dir(), 'frak-test-');
        file_put_contents($tmpPath, $svg);

        try {
            $result = FrakLogoUploader::processUpload(
                [
                    'name' => 'logo.svg',
                    'tmp_name' => $tmpPath,
                    'error' => 0,
                    'size' => strlen($svg),
                ],
                'https://shop.example.com/'
            );

            $this->assertSame(['error' => FrakLogoUploader::ERROR_MOVE_FAILED], $result);
        } finally {
            @unlink($tmpPath);
        }
    }

    public function testRejectsHtmlSmuggledAsSvg(): void
    {
        // HTML / PHP smuggled with a `.svg` extension fails the prefix sniff
        // because the first non-whitespace bytes are `<!doctype` / `<html` /
        // `<?php`, not `<?xml` / `<svg`.
        $html = '<!doctype html><html><body>not svg</body></html>';
        $tmpPath = (string) tempnam(sys_get_temp_dir(), 'frak-test-');
        file_put_contents($tmpPath, $html);

        try {
            $result = FrakLogoUploader::processUpload(
                [
                    'name' => 'fake.svg',
                    'tmp_name' => $tmpPath,
                    'error' => 0,
                    'size' => strlen($html),
                ],
                'https://shop.example.com/'
            );

            $this->assertSame(['error' => FrakLogoUploader::ERROR_MIME_MISMATCH], $result);
        } finally {
            @unlink($tmpPath);
        }
    }

    public function testIsLocalUrlAcceptsOurUploadsPrefixWhenFileExists(): void
    {
        $baseUrl = 'https://shop.example.com/';
        $uploadsDir = _PS_MODULE_DIR_ . 'frakintegration/uploads/';
        if (!is_dir($uploadsDir)) {
            mkdir($uploadsDir, 0755, true);
        }
        $filename = 'logo_' . uniqid() . '.png';
        file_put_contents($uploadsDir . $filename, "\x89PNG\r\n\x1a\n");

        try {
            $this->assertTrue(FrakLogoUploader::isLocalUrl(
                $baseUrl . 'modules/frakintegration/uploads/' . $filename,
                $baseUrl
            ));
        } finally {
            @unlink($uploadsDir . $filename);
        }
    }

    public function testIsLocalUrlRejectsForeignDomains(): void
    {
        $this->assertFalse(FrakLogoUploader::isLocalUrl(
            'https://evil.example.com/modules/frakintegration/uploads/x.png',
            'https://shop.example.com/'
        ));
    }

    public function testIsLocalUrlRejectsMissingFile(): void
    {
        // Prefix matches but the underlying file is absent — guards against a
        // crafted URL pointing at a path that never had an upload.
        $this->assertFalse(FrakLogoUploader::isLocalUrl(
            'https://shop.example.com/modules/frakintegration/uploads/never-uploaded-' . uniqid() . '.png',
            'https://shop.example.com/'
        ));
    }

    /**
     * Minimal-but-valid 1x1 PNG (signature + IHDR + IDAT + IEND). libmagic
     * recognises it as `image/png` so it satisfies the MIME gate; tests reuse
     * it whenever they need a file that the validator accepts.
     */
    private static function pngFixture(): string
    {
        return "\x89PNG\r\n\x1a\n"
            . "\x00\x00\x00\x0dIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
            . "\x00\x00\x00\x0dIDAT\x78\x9c\x62\x00\x01\x00\x00\x05\x00\x01\x0d\x0a\x2d\xb4"
            . "\x00\x00\x00\x00IEND\xaeB`\x82";
    }
}
