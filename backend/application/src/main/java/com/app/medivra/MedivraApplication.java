package com.app.medivra;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = "com.app")
@EntityScan(basePackages = "com.app")
@EnableJpaRepositories(basePackages = "com.app")
@EnableAsync
@EnableScheduling
public class MedivraApplication {

	public static void main(String[] args) {
		SpringApplication.run(MedivraApplication.class, args);
	}

}
