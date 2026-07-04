pipeline {
    agent any

    environment {
        IMAGE_NAME = 'docker.io/venuvgp19/badminton_rotator:latest'
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
                sh 'sudo podman build --network=host -t ${IMAGE_NAME} .'
            }
        }

        stage('Push Image') {
            steps {
                echo 'Logging in and pushing image to Docker Hub...'
                withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', passwordVariable: 'DOCKER_PASSWORD', usernameVariable: 'DOCKER_USERNAME')]) {
                    sh 'sudo podman login -u $DOCKER_USERNAME -p $DOCKER_PASSWORD docker.io'
                    sh 'sudo podman push ${IMAGE_NAME}'
                }
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
