# Use an official Python runtime as a parent image.
FROM python:3.9-slim

# Set the working directory in the container.
WORKDIR /app

# Copy the requirements file and install dependencies.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code.
COPY . .

# Expose the port that uvicorn will listen on.
EXPOSE 8123

# Run the application using uvicorn.
CMD ["uvicorn", "serve:app", "--host", "0.0.0.0", "--port", "8123"]
