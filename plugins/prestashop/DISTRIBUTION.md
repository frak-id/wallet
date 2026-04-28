# Frak Integration Module Distribution

This document explains how to create and distribute the Frak Integration PrestaShop module.

## Quick Bundle Creation

To create a distribution-ready zip file of the module:

```bash
./bundle.sh
```

This will create a file named `frakintegration-v1.0.0.zip` that contains all necessary module files.

## What's Included in the Bundle

The bundle script includes:
- ✅ Core module files (`frakintegration.php`, `config.xml`)
- ✅ Module logos (`logo.gif`, `logo.png`)
- ✅ Classes directory (`classes/`)
- ✅ Controllers directory (`controllers/`)
- ✅ Views and templates (`views/`)
- ✅ Override directory (`override/`)

## What's Excluded from the Bundle

The bundle script automatically excludes:
- ❌ Test directory (`test/`)
- ❌ Git files (`.git`, `.gitignore`)
- ❌ Development files (`README.md`, this file)
- ❌ macOS system files (`.DS_Store`)
- ❌ Python cache files

## Client Installation Instructions

Send these instructions to your clients along with the zip file:

### For PrestaShop 1.7+ (Recommended Method)

1. **Login to PrestaShop Admin Panel**
   - Go to your PrestaShop back office
   - Navigate to `Modules & Services`

2. **Upload the Module**
   - Click on `Upload a module` button
   - Select the `frakintegration-v1.0.0.zip` file
   - Click `Upload this module`

3. **Install and Configure**
   - After upload, click `Install`
   - Once installed, click `Configure` to set up the module settings

### Alternative Method (FTP)

1. **Extract the zip file** on your local machine
2. **Upload via FTP** the `frakintegration` folder to `/modules/` directory on your PrestaShop server
3. **Go to Modules & Services** in your admin panel
4. **Find "Frak Integration"** in the modules list and click `Install`

## Module Requirements

- **PrestaShop Version**: 1.7 or higher
- **PHP Version**: Compatible with your PrestaShop installation
- **Dependencies**: None (module is self-contained)

## Support

For installation support or issues, contact the Frak team.

## Version History

- **v1.0.0**: Initial release with core Frak integration features 