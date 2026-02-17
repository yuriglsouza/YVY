
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score
import joblib
import os

# Paths
current_dir = os.path.dirname(os.path.abspath(__file__))
dataset_path = os.path.join(current_dir, "../dataset.csv")
model_path = os.path.join(current_dir, "../model.pkl")

def train():
    print("🚀 Loading dataset...")
    if not os.path.exists(dataset_path):
        print(f"❌ Error: Dataset not found at {dataset_path}")
        return

    df = pd.read_csv(dataset_path)
    
    # Preprocessing
    print(f"📊 Original data shape: {df.shape}")
    
    # Drop rows without NDVI (target)
    df = df.dropna(subset=['ndvi'])
    
    # Feature Engineering
    df['date'] = pd.to_datetime(df['date'])
    df['month'] = df['date'].dt.month
    df['day_of_year'] = df['date'].dt.dayofyear
    
    # Fill missing feature values with mean or reasonable defaults
    # For now, simplistic approach: drop remaining NaNs in features we care about
    # Features: farm_id, month, day_of_year, temperature (if available)
    
    features = ['farm_id', 'month', 'day_of_year']
    
    # If temperature has too many nulls, maybe skip it. Let's check.
    # For this MVP, we'll try to include it if valid, else fill with mean.
    if 'temperature' in df.columns:
        mean_temp = df['temperature'].mean()
        df['temperature'] = df['temperature'].fillna(mean_temp)
        features.append('temperature')

    X = df[features]
    y = df['ndvi']
    
    print(f"⚙️ Training with features: {features}")
    print(f"📈 Data samples for training: {len(df)}")

    if len(df) < 10:
        print("⚠️ Not enough data to train a reliable model. Need > 10 samples.")
        return

    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Model: Random Forest
    # Good for non-linear relationships and requires little tuning
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Evaluate
    predictions = model.predict(X_test)
    mse = mean_squared_error(y_test, predictions)
    r2 = r2_score(y_test, predictions)
    
    print(f"\n✅ Model Trained!")
    print(f"   MSE: {mse:.4f}")
    print(f"   R2 Score: {r2:.4f}")
    
    # Save Feature names with the model (hacky way, or use a pipeline)
    # We will just save the model object.
    
    joblib.dump(model, model_path)
    print(f"💾 Model saved to: {model_path}")

if __name__ == "__main__":
    train()
