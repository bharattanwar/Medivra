package com.app.medivra;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = "com.app")
@EntityScan(basePackages = "com.app")
@EnableJpaRepositories(basePackages = "com.app")
public class MedivraApplication {

	public static void main(String[] args) {
		SpringApplication.run(MedivraApplication.class, args);
	}

}
