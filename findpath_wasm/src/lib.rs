use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::BinaryHeap;
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct Point3D {
    pub x: i32,
    pub y: i32,
    pub z: i32,
}

struct GridBounds {
    min_x: i32,
    max_x: i32,
    min_y: i32,
    max_y: i32,
    min_z: i32,
    max_z: i32,
    size_x: usize,
    size_y: usize,
    size_z: usize,
}

impl GridBounds {
    fn new(min_x: i32, max_x: i32, min_y: i32, max_y: i32, min_z: i32, max_z: i32) -> Self {
        assert!(min_x <= max_x, "min_x must be <= max_x");
        assert!(min_y <= max_y, "min_y must be <= max_y");
        assert!(min_z <= max_z, "min_z must be <= max_z");

        let size_x = (max_x - min_x + 1) as usize;
        let size_y = (max_y - min_y + 1) as usize;
        let size_z = (max_z - min_z + 1) as usize;

        Self {
            min_x,
            max_x,
            min_y,
            max_y,
            min_z,
            max_z,
            size_x,
            size_y,
            size_z,
        }
    }

    fn total_voxels(&self) -> usize {
        self.size_x * self.size_y * self.size_z
    }
}

impl Point3D {
    fn to_index(&self, bounds: &GridBounds) -> Option<usize> {
        if self.x < bounds.min_x
            || self.x > bounds.max_x
            || self.y < bounds.min_y
            || self.y > bounds.max_y
            || self.z < bounds.min_z
            || self.z > bounds.max_z
        {
            return None;
        }

        let x = (self.x - bounds.min_x) as usize;
        let y = (self.y - bounds.min_y) as usize;
        let z = (self.z - bounds.min_z) as usize;
        Some(x + y * bounds.size_x + z * bounds.size_x * bounds.size_y)
    }

    fn from_index(idx: usize, bounds: &GridBounds) -> Self {
        let z = idx / (bounds.size_x * bounds.size_y);
        let rem = idx % (bounds.size_x * bounds.size_y);
        let y = rem / bounds.size_x;
        let x = rem % bounds.size_x;
        Point3D {
            x: x as i32 + bounds.min_x,
            y: y as i32 + bounds.min_y,
            z: z as i32 + bounds.min_z,
        }
    }

    pub fn chebyshev_distance(&self, other: &Point3D) -> u32 {
        let dx = (self.x as i32 - other.x as i32).abs() as u32;
        let dy = (self.y as i32 - other.y as i32).abs() as u32;
        let dz = (self.z as i32 - other.z as i32).abs() as u32;
        dx.max(dy).max(dz)
    }

    fn lower_bound_distance(&self, other: &Point3D) -> f32 {
        let dx = (self.x as i64 - other.x as i64).abs();
        let dy = (self.y as i64 - other.y as i64).abs();
        let dz = (self.z as i64 - other.z as i64).abs();
        let horizontal = (dx.max(dy) + 1) / 2;
        horizontal.max(dz * 2) as f32
    }

    fn euclidean_distance(&self, other: &Point3D) -> f64 {
        let dx = (self.x as f64) - (other.x as f64);
        let dy = (self.y as f64) - (other.y as f64);
        let dz = (self.z as f64) - (other.z as f64);
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
}

fn improves_path(
    candidate_cost: f32,
    candidate_distance: f64,
    current_cost: f32,
    current_distance: f64,
) -> bool {
    candidate_cost < current_cost
        || (candidate_cost == current_cost && candidate_distance < current_distance)
}

fn heuristic_scale(shortcuts: &[Vec<(usize, f32)>], bounds: &GridBounds) -> f32 {
    let mut scale: f32 = 1.0;
    for (from_idx, edges) in shortcuts.iter().enumerate() {
        let from = Point3D::from_index(from_idx, bounds);
        for &(to_idx, cost) in edges {
            let distance = from.lower_bound_distance(&Point3D::from_index(to_idx, bounds));
            if distance > 0.0 {
                scale = scale.min(cost / distance);
            }
        }
    }
    scale
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Shortcut {
    pub from: Point3D,
    pub to: Point3D,
    pub cost: f32,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
pub struct PathStep {
    pub x: i32,
    pub y: i32,
    pub z: i32,
    pub cost: f32,
    pub shortcut: bool,
}

impl PathStep {
    fn from_point(point: Point3D, cost: f32, shortcut: bool) -> Self {
        Self {
            x: point.x,
            y: point.y,
            z: point.z,
            cost,
            shortcut,
        }
    }
}

#[derive(Copy, Clone)]
struct State {
    f_score: f32,
    g_score: f32,
    direct_distance: f64,
    node: usize,
}

impl PartialEq for State {
    fn eq(&self, other: &Self) -> bool {
        self.f_score == other.f_score
            && self.g_score == other.g_score
            && self.direct_distance == other.direct_distance
            && self.node == other.node
    }
}

impl Eq for State {}

impl Ord for State {
    fn cmp(&self, other: &Self) -> Ordering {
        // Inversion pour transformer le BinaryHeap en Min-Heap
        other
            .f_score
            .total_cmp(&self.f_score)
            .then_with(|| other.direct_distance.total_cmp(&self.direct_distance))
            .then_with(|| other.g_score.total_cmp(&self.g_score))
            .then_with(|| other.node.cmp(&self.node))
    }
}

impl PartialOrd for State {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

#[wasm_bindgen]
pub struct PathFinder3D {
    bounds: GridBounds,
    grid_obstacles: Vec<bool>,         // true si infranchissable
    shortcuts: Vec<Vec<(usize, f32)>>, // Adjacence par index de voxel
}

#[wasm_bindgen]
impl PathFinder3D {
    #[wasm_bindgen(constructor)]
    pub fn new(min_x: i32, max_x: i32, min_y: i32, max_y: i32, min_z: i32, max_z: i32) -> Self {
        let bounds = GridBounds::new(min_x, max_x, min_y, max_y, min_z, max_z);
        let total_voxels = bounds.total_voxels();

        PathFinder3D {
            bounds,
            grid_obstacles: vec![false; total_voxels],
            shortcuts: vec![Vec::new(); total_voxels],
        }
    }

    pub fn set_obstacle(&mut self, x: i32, y: i32, z: i32, is_obstacle: bool) {
        if let Some(idx) = (Point3D { x, y, z }).to_index(&self.bounds) {
            self.grid_obstacles[idx] = is_obstacle;
        }
    }

    pub fn add_shortcut(&mut self, from: JsValue, to: JsValue, cost: f32) {
        if !cost.is_finite() || cost < 0.0 {
            return;
        }

        let from_pt: Point3D = serde_wasm_bindgen::from_value(from).unwrap();
        let to_pt: Point3D = serde_wasm_bindgen::from_value(to).unwrap();

        let (Some(from_idx), Some(to_idx)) =
            (from_pt.to_index(&self.bounds), to_pt.to_index(&self.bounds))
        else {
            return;
        };

        self.shortcuts[from_idx].push((to_idx, cost));
    }

    pub fn find_path(&self, start: JsValue, target: JsValue) -> JsValue {
        let start_pt: Point3D = serde_wasm_bindgen::from_value(start).unwrap();
        let target_pt: Point3D = serde_wasm_bindgen::from_value(target).unwrap();

        let (Some(start_idx), Some(target_idx)) = (
            start_pt.to_index(&self.bounds),
            target_pt.to_index(&self.bounds),
        ) else {
            return serde_wasm_bindgen::to_value(&Vec::<PathStep>::new()).unwrap();
        };

        let mut g_score = vec![f32::INFINITY; self.bounds.total_voxels()];
        let mut direct_distance = vec![f64::INFINITY; self.bounds.total_voxels()];
        let mut parent = vec![usize::MAX; self.bounds.total_voxels()];
        let mut step_cost = vec![0.0; self.bounds.total_voxels()];
        let mut step_shortcut = vec![false; self.bounds.total_voxels()];
        let mut open_set = BinaryHeap::new();

        g_score[start_idx] = 0.0;
        direct_distance[start_idx] = 0.0;
        let scale = heuristic_scale(&self.shortcuts, &self.bounds);
        open_set.push(State {
            f_score: start_pt.lower_bound_distance(&target_pt) * scale,
            g_score: 0.0,
            direct_distance: 0.0,
            node: start_idx,
        });

        while let Some(State {
            g_score: queued_g,
            direct_distance: queued_distance,
            node,
            ..
        }) = open_set.pop()
        {
            if queued_g > g_score[node]
                || (queued_g == g_score[node] && queued_distance > direct_distance[node])
            {
                continue;
            }

            if node == target_idx {
                // Reconstruction du chemin
                let mut path = Vec::new();
                let mut curr = target_idx;
                while curr != usize::MAX {
                    path.push(PathStep::from_point(
                        Point3D::from_index(curr, &self.bounds),
                        step_cost[curr],
                        step_shortcut[curr],
                    ));
                    curr = parent[curr];
                }
                path.reverse();
                return serde_wasm_bindgen::to_value(&path).unwrap();
            }

            let current_g = g_score[node];
            let current_direct_distance = direct_distance[node];
            let current_pt = Point3D::from_index(node, &self.bounds);

            // 1. Exploration des voisins de la grille. Au niveau z=0,
            // les déplacements horizontaux peuvent couvrir deux cellules.
            let x = current_pt.x;
            let y = current_pt.y;
            let z = current_pt.z;
            let max_horizontal_step = if z == 0 { 2 } else { 1 };

            for dx in -max_horizontal_step..=max_horizontal_step {
                for dy in -max_horizontal_step..=max_horizontal_step {
                    for dz in -1..=1 {
                        if dx == 0 && dy == 0 && dz == 0 {
                            continue;
                        }

                        let nx = x + dx;
                        let ny = y + dy;
                        let nz = z + dz;

                        if nx >= self.bounds.min_x
                            && nx <= self.bounds.max_x
                            && ny >= self.bounds.min_y
                            && ny <= self.bounds.max_y
                            && nz >= self.bounds.min_z
                            && nz <= self.bounds.max_z
                        {
                            let next_pt = Point3D {
                                x: nx,
                                y: ny,
                                z: nz,
                            };
                            let v_idx = next_pt.to_index(&self.bounds).unwrap();

                            if self.grid_obstacles[v_idx] {
                                continue;
                            }

                            let move_cost = if dz != 0 { 2.0 } else { 1.0 };
                            let tentative_g = current_g + move_cost;
                            let tentative_distance =
                                current_direct_distance + current_pt.euclidean_distance(&next_pt);
                            if improves_path(
                                tentative_g,
                                tentative_distance,
                                g_score[v_idx],
                                direct_distance[v_idx],
                            ) {
                                parent[v_idx] = node;
                                step_cost[v_idx] = move_cost;
                                g_score[v_idx] = tentative_g;
                                direct_distance[v_idx] = tentative_distance;
                                open_set.push(State {
                                    f_score: tentative_g
                                        + next_pt.lower_bound_distance(&target_pt) * scale,
                                    g_score: tentative_g,
                                    direct_distance: tentative_distance,
                                    node: v_idx,
                                });
                            }
                        }
                    }
                }
            }

            // 2. Exploration des raccourcis
            for &(next_idx, cost) in &self.shortcuts[node] {
                if self.grid_obstacles[next_idx] {
                    continue;
                }

                let tentative_g = current_g + cost;
                let next_pt = Point3D::from_index(next_idx, &self.bounds);
                let tentative_distance =
                    current_direct_distance + current_pt.euclidean_distance(&next_pt);
                if improves_path(
                    tentative_g,
                    tentative_distance,
                    g_score[next_idx],
                    direct_distance[next_idx],
                ) {
                    parent[next_idx] = node;
                    step_cost[next_idx] = cost;
                    step_shortcut[next_idx] = true;
                    g_score[next_idx] = tentative_g;
                    direct_distance[next_idx] = tentative_distance;
                    open_set.push(State {
                        f_score: tentative_g + next_pt.lower_bound_distance(&target_pt) * scale,
                        g_score: tentative_g,
                        direct_distance: tentative_distance,
                        node: next_idx,
                    });
                }
            }
        }

        // Pas de chemin trouvé
        serde_wasm_bindgen::to_value(&Vec::<PathStep>::new()).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::{GridBounds, Point3D, heuristic_scale, improves_path};

    #[test]
    fn geometric_lower_bound_covers_horizontal_and_vertical_costs() {
        let start = Point3D { x: 0, y: 0, z: 0 };
        let horizontal_target = Point3D { x: 5, y: 2, z: 0 };
        let vertical_target = Point3D { x: 1, y: 0, z: -2 };

        assert_eq!(start.lower_bound_distance(&horizontal_target), 3.0);
        assert_eq!(start.lower_bound_distance(&vertical_target), 4.0);
    }

    #[test]
    fn cheap_shortcuts_reduce_the_heuristic_scale() {
        let bounds = GridBounds::new(0, 10, 0, 0, 0, 0);
        let mut shortcuts = vec![Vec::new(); bounds.total_voxels()];
        shortcuts[0].push((10, 2.0));

        assert_eq!(heuristic_scale(&shortcuts, &bounds), 0.4);
    }

    #[test]
    fn equal_cost_paths_prefer_the_shorter_euclidean_route() {
        let straight = Point3D { x: 3, y: 4, z: 0 };
        let origin = Point3D { x: 0, y: 0, z: 0 };

        assert_eq!(origin.euclidean_distance(&straight), 5.0);
        assert!(improves_path(10.0, 5.0, 10.0, 6.0));
        assert!(!improves_path(10.0, 7.0, 10.0, 6.0));
        assert!(!improves_path(11.0, 1.0, 10.0, 6.0));
    }
}
