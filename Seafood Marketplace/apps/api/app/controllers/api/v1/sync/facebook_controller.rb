module Api
  module V1
    module Sync
      class FacebookController < ApplicationController
        before_action :authenticate_worker!

        def create
          payload = parse_json(request.raw_post)
          products = payload['products'] || params[:products]
          return render json: { error: 'products is required' }, status: :unprocessable_entity if products.blank?

          FacebookSyncJob.perform_later(products)
          render json: { status: 'ok', message: "Facebook sync queued for #{products.size} products" }
        rescue JSON::ParserError
          render json: { error: 'Invalid JSON payload' }, status: :unprocessable_entity
        end

        def callback
          payload = parse_json(request.raw_post)
          result = payload['result'] || payload

          SyncLog.create!(
            platform: 'facebook',
            status: result['status'] || 'unknown',
            products_synced: result['products_synced'] || result['synced'] || 0,
            errors: result['errors'],
            synced_at: Time.current
          )

          render json: { status: 'ok', message: 'Callback received' }
        rescue JSON::ParserError
          render json: { error: 'Invalid JSON payload' }, status: :unprocessable_entity
        rescue StandardError => e
          render json: { error: e.message }, status: :unprocessable_entity
        end

        private

        def parse_json(raw)
          return {} if raw.blank?

          JSON.parse(raw)
        end
      end
    end
  end
end
