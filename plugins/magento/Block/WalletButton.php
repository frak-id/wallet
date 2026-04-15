<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Block;

use FrakLabs\Sdk\Model\Config;
use Magento\Framework\View\Element\Template;

class WalletButton extends Template
{
    /**
     * Initialize block with SDK config dependency
     *
     * @param Template\Context $context
     * @param Config $config
     * @param array $data
     */
    public function __construct(
        Template\Context $context,
        private readonly Config $config,
        array $data = []
    ) {
        parent::__construct($context, $data);
    }

    /**
     * Check if the Frak SDK module is enabled
     *
     * @return bool
     */
    public function isEnabled(): bool
    {
        return $this->config->isEnabled();
    }

    /**
     * Get the wallet button position (left or right)
     *
     * @return string
     */
    public function getPosition(): string
    {
        return $this->config->getWalletButtonPosition() ?? "right";
    }
}
