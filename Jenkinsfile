
pipeline {
    agent any

    stages {
        stage('Checkout') {
            steps {
                echo 'Checking out project source code'
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                bat 'npm ci'
            }
        }

        stage('Run API Tests') {
            steps {
                bat 'npm test'
            }
        }
    }

    post {
        success {
            echo 'SUCCESS: All pipeline stages completed.'
        }
        failure {
            echo 'FAILURE: Check the console output for errors.'
        }
        always {
            echo 'Jenkins pipeline execution finished.'
        }
    }
}
