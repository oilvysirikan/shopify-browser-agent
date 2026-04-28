module Api
  module V1
    class ProductsController < ApplicationController
      def index
        render json: { items: [] }
      end

      def show
        render json: { id: params[:id] }
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
