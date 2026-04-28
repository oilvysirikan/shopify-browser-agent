module Api
  module V1
    class MarketplaceController < ApplicationController
      def index
        render json: {
          name: 'Seafood Marketplace',
          version: 'v1',
          features: [
            'Product management',
            'Order management',
            'Vendor marketplace'
          ]
        }
      end
    end
  end
end
