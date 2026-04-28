class GoogleSyncJob < ApplicationJob
  queue_as :default

  def perform(product_ids)
    Rails.logger.info("Google sync queued for products: #{Array(product_ids).join(',')}")
  end
end
