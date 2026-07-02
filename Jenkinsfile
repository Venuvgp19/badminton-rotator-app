pipeline {
    agent any

    environment {
        IMAGE_NAME = 'localhost/badminton-rotator-app:latest'
    }

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out code from Git...'
                checkout scm: [
                    $class: 'GitSCM',
                    branches: [[name: '*/main']],
                    userRemoteConfigs: [[
                        credentialsId: 'github-credentials',
                        url: 'https://github.com/Venuvgp19/badminton-rotator-app.git'
                    ]]
                ]
            }
        }

        stage('Build Image') {
            steps {
                echo 'Building container image using Podman...'
                sh 'sudo podman build -t ${IMAGE_NAME} .'
            }
        }

        stage('Import to Containerd') {
            steps {
                echo 'Importing container image into Kubernetes containerd namespace...'
                sh 'sudo podman save ${IMAGE_NAME} | sudo ctr -n=k8s.io images import -'
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                echo 'Deploying application to Kubernetes cluster...'
                sh 'sudo kubectl apply -f k8s-deployment.yaml'
            }
        }

        stage('Verify Rollout') {
            steps {
                echo 'Verifying rollout status...'
                sh 'sudo kubectl rollout status deployment/badminton-rotator'
                sh 'sudo kubectl get pods -l app=badminton-rotator'
            }
        }
    }
}
