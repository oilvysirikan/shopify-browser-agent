module Api
  module V1
    class HealthController < ApplicationController
      def index
        render json: {
          status: 'ok',
          service: 'seafood-marketplace-api',
          time: Time.current.iso8601
        }
      end
    end
  end
end
