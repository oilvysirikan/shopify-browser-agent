module Api
  module V1
    class CampaignsController < ApplicationController
      def index
        render json: { items: [] }
      end

      def create
        render json: { created: true }, status: :created
      end

      def update
        render json: { updated: true }
      end

      def destroy
        head :no_content
      end
    end
  end
end
