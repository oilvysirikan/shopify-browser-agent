module Api
  module V1
    class FeedsController < ApplicationController
      def index
        render json: { items: [] }
      end

      def create
        render json: { created: true }, status: :created
      end

      def update
        render json: { updated: true }
      end
    end
  end
end
