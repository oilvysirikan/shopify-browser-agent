module Api
  module V1
    module Webhooks
      module Shopify
        class ShopifyController < ApplicationController
          before_action :authenticate_worker!
          before_action :ensure_webhook_verified!

          def product_update
            queue_facebook_sync
          end

          def product_create
            queue_facebook_sync
          end

          def product_delete
            payload = parse_json(request.raw_post)
            Rails.logger.info("Shopify product_delete received: #{payload['id'] || payload.dig('product', 'id')}")
            render json: { status: 'ok', message: 'Product delete webhook received' }
          rescue JSON::ParserError
            render json: { error: 'Invalid JSON payload' }, status: :unprocessable_entity
          end

          private

          def queue_facebook_sync
            payload = parse_json(request.raw_post)
            product_payload = payload['product'] || payload

            FacebookSyncJob.perform_later([product_payload])
            render json: { status: 'ok', message: 'Sync queued' }
          rescue JSON::ParserError
            render json: { error: 'Invalid JSON payload' }, status: :unprocessable_entity
          end

          def parse_json(raw)
            return {} if raw.blank?

            JSON.parse(raw)
          end
        end
      end
    end
  end
end
