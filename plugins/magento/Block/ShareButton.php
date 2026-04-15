<?php
declare(strict_types=1);

namespace FrakLabs\Sdk\Block;

use FrakLabs\Sdk\Model\Config;
use Magento\Framework\View\Element\Template;

class ShareButton extends Template
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
     * Check if the share button should be displayed
     *
     * @return bool
     */
    public function showShareButton(): bool
    {
        return $this->config->showShareButton();
    }

    /**
     * Get the share button label text
     *
     * @return string
     */
    public function getShareButtonText(): string
    {
        return "Share";
    }

    /**
     * Check if reward incentive should be shown with the share button
     *
     * @return bool
     */
    public function useReward(): bool
    {
        return true;
    }
}
