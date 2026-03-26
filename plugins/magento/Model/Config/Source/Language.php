<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Model\Config\Source;

use Magento\Framework\Data\OptionSourceInterface;

class Language implements OptionSourceInterface
{
    /**
     * @inheritdoc
     */
    public function toOptionArray(): array
    {
        return [
            ["value" => "en", "label" => "English"],
            ["value" => "fr", "label" => "French"],
            ["value" => "es", "label" => "Spanish"],
            ["value" => "de", "label" => "German"],
            ["value" => "it", "label" => "Italian"],
            ["value" => "pt", "label" => "Portuguese"],
            ["value" => "nl", "label" => "Dutch"],
            ["value" => "ja", "label" => "Japanese"],
            ["value" => "ko", "label" => "Korean"],
            ["value" => "zh", "label" => "Chinese"],
        ];
    }
}
