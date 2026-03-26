<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Model\Config\Source;

use Magento\Framework\Data\OptionSourceInterface;

class ButtonPosition implements OptionSourceInterface
{
    /**
     * @inheritdoc
     */
    public function toOptionArray(): array
    {
        return [
            ["value" => "left", "label" => "Left"],
            ["value" => "right", "label" => "Right"],
        ];
    }
}
