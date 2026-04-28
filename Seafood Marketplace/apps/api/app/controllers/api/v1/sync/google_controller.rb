module Api
  module V1
    module Sync
      class GoogleController < ApplicationController
        before_action :authenticate_worker!

        def callback
          payload = parse_json(request.raw_post)
          result = payload['result'] || payload

          SyncLog.create!(
            platform: 'google',
            status: result['status'] || 'unknown',
            products_synced: result['products_synced'] || 0,
            errors: result['errors'],
            synced_at: Time.current
          )

          render json: { status: 'ok', message: 'Google callback received' }
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
