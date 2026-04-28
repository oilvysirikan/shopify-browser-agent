class CreateSyncLogs < ActiveRecord::Migration[6.1]
  def change
    create_table :sync_logs do |t|
      t.string :platform, null: false
      t.string :status
      t.integer :products_synced, default: 0
      t.json :errors
      t.datetime :synced_at

      t.timestamps
    end

    add_index :sync_logs, :platform
    add_index :sync_logs, :status
  end
end
