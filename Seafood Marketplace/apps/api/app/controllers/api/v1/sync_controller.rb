module Api
  module V1
    class SyncController < ApplicationController
      before_action :authenticate_worker!

      def trigger_facebook
        product_ids = params[:product_ids] || fetch_default_product_ids

        FacebookSyncJob.perform_later(product_ids)
        render json: { status: 'ok', message: "Facebook sync queued for #{product_ids.count} products" }
      end

      def trigger_google
        product_ids = params[:product_ids] || fetch_default_product_ids

        GoogleSyncJob.perform_later(product_ids)
        render json: { status: 'ok', message: "Google sync queued for #{product_ids.count} products" }
      end

      private

      def fetch_default_product_ids
        Product.limit(100).pluck(:id)
      rescue StandardError
        []
      end
    end
  end
end
