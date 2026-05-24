package com.app.doctor.repository;

import com.app.doctor.entity.Doctor;
import com.app.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DoctorRepository extends JpaRepository<Doctor, UUID> {

    Optional<Doctor> findByUserId(UUID userId);

    boolean existsByUserId(UUID userId);

    List<Doctor> findBySpecializationContainingIgnoreCase(String specialization);

    @Query("SELECT d FROM Doctor d JOIN d.user u WHERE " +
           "d.isApproved = true AND " +
           "(LOWER(d.specialization) LIKE LOWER(CONCAT('%', COALESCE(:specialization, ''), '%'))) " +
           "AND (LOWER(d.city) LIKE LOWER(CONCAT('%', COALESCE(:city, ''), '%'))) " +
           "AND (LOWER(u.fullName) LIKE LOWER(CONCAT('%', COALESCE(:name, ''), '%')))")
    List<Doctor> searchDoctors(@Param("specialization") String specialization,
                               @Param("city") String city,
                               @Param("name") String name);
}
