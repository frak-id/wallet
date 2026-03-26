<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Block;

use FrakLabs\Sdk\Model\Config;
use Magento\Framework\View\Element\Template;

class OpenInApp extends Template
{
    public function __construct(
        Template\Context $context,
        private readonly Config $config,
        array $data = []
    ) {
        parent::__construct($context, $data);
    }

    public function isEnabled(): bool
    {
        return $this->config->isEnabled();
    }
}
