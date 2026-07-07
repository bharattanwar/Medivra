package com.app.emergency.repository;

import com.app.emergency.entity.Ambulance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AmbulanceRepository extends JpaRepository<Ambulance, UUID> {

    Optional<Ambulance> findByDriverId(UUID driverId);

    List<Ambulance> findByIsOnlineTrueAndIsAvailableTrue();

    /**
     * Haversine-based nearest ambulance query (identical pattern to pharmacy-module).
     * Returns ambulances within radiusKm sorted by distance ascending.
     */
    @Query(value = """
        SELECT a.*,
               (6371 * acos(
                   cos(radians(:lat)) * cos(radians(a.current_lat)) *
                   cos(radians(a.current_lng) - radians(:lng)) +
                   sin(radians(:lat)) * sin(radians(a.current_lat))
               )) AS distance_km
        FROM ambulances a
        WHERE a.is_online = TRUE
          AND a.is_available = TRUE
          AND a.current_lat IS NOT NULL
          AND a.current_lng IS NOT NULL
          AND (6371 * acos(
               cos(radians(:lat)) * cos(radians(a.current_lat)) *
               cos(radians(a.current_lng) - radians(:lng)) +
               sin(radians(:lat)) * sin(radians(a.current_lat))
          )) <= :radiusKm
        ORDER BY distance_km ASC
        LIMIT :limit
        """, nativeQuery = true)
    List<Ambulance> findNearbyAvailableAmbulances(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("radiusKm") double radiusKm,
            @Param("limit") int limit);
}
