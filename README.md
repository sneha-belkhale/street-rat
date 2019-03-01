# *~*~*~<>~ cyborg rat in the city ~<>~*~*~* 

### inspired by the futuristic cyberpunk HK & made with three.js


#### While making this demo, we made some reusable utilities related to new advances in 3D Web Graphics.  
 #### [ + ] Box Projected Env Maps for realistic reflections
 #### [ + ] Procedural Animation with Inverse Kinematics 
 #### [ + ] Collision (yes I know it's been implemented 100 times.. but for some reason I could not find a usable example)
 #### [ + ] Importing scenes from HoudiniFX into three.js



### Two Phase Collision Optimization
For this game, we find the next foot position of the rat by raycasting onto the nearby surfaces. We may need to do raycasts in a range of angles for complicated surface scenarios. So, since we forecast to have 200+ meshes in the scene, this could amount to around 800 raycast calculations per step! Even though the three.js raycaster has optimizations where it first checks for ray intersection with the bounding box of the mesh, this is still order (n) operation which is not optimal.

we decided to go with a two phase approach, first creating a sparse grid to segment the space, which we will use to query objects in a radius. We looked into octrees for this, but there wasn't a sufficient example for javascript, so ended up starting with a basic linear grid. This step should bring a subset of the objects in the scene, which you can then use the standard three.js raycaster to get the exact point of intersection. 

Here is an example of how to use it: 

#### 1. initialize sparse grid with a cell size that makes sense for your scene. 

`var worldGrid = new SparseWorldGrid(20);`

#### 2. Add mesh to the sparse grid. This will fill the appropriate cells (w.r.t the mesh bbox) with a pointer to the mesh. Multiple meshes may occupy the same grid, and that is expected with larger cell sizes.

`worldGrid.fillGridForMesh(collisionMesh);`

#### 3. Before raycasting, query meshes in a cell radius from the position. My cell size was 20 units, which was way 2 times the size of the character, so a radius of 1 (20 units) was more than enough. 

`var meshes = this.worldGrid.queryPointsInRadius(basePos.x, basePos.y, basePos.z, 1)`

#### 4. raycast the subset!
`var n = this.raycaster.intersectObjects(meshes);`






