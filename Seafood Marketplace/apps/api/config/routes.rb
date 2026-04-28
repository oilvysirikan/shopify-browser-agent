Rails.application.routes.draw do
  get '/health', to: 'health#index'

  namespace :api do
    namespace :v1 do
      get '/health', to: 'health#index'
      get '/marketplace', to: 'marketplace#index'

      resources :products, only: [:index, :show, :create, :update, :destroy]
      resources :feeds, only: [:index, :create, :update]
      resources :campaigns, only: [:index, :create, :update, :destroy]

      namespace :webhooks do
        namespace :shopify do
          post 'product_update', to: 'shopify#product_update'
          post 'product_create', to: 'shopify#product_create'
          post 'product_delete', to: 'shopify#product_delete'
        end
      end

      namespace :sync do
        post 'facebook/callback', to: 'facebook#callback'
        post 'google/callback', to: 'google#callback'
      end

      post 'sync/facebook/trigger', to: 'sync#trigger_facebook'
      post 'sync/google/trigger', to: 'sync#trigger_google'
      post 'sync/facebook', to: 'sync/facebook#create'
    end
  end
end
