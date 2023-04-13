import { useEffect, useState } from 'react';
import * as d3 from 'd3';
import _ from 'lodash';
import './App.css';
import data from './movies.json';

function App() {
  const [width, setWidth] = useState(window.innerWidth);
  const [height, setHeight] = useState(window.innerHeight);
  const [graph, setGraph] = useState(null);
  const [simulationHandle, setSimulationHandle] = useState(null);

  useEffect(() => {
    const movies = _.chain(data)
    .map(d => ({
      title: d.Title,
      released: new Date(d.Released),
      genres: d.Genre.split(', '),
      rating: +d.imdbRating,
      votes: +(d.imdbVotes.replace(/,/g, '')),
      rated: d.Rated
    }))
    .sortBy(d => -d.released)
    .value();

    function calculateData() {
      const topGenres = ["Action", "Comedy", "Animation", "Drama"];
      const petalColors = ['#ffc8f0', '#cbf2bd', '#afe9ff', '#ffb09e'];
      const petalPaths = [
        'M0 0 C50 50 50 100 0 100 C-50 100 -50 50 0 0',
        'M-35 0 C-25 25 25 25 35 0 C50 25 25 75 0 100 C-25 75 -50 25 -35 0',
        'M0,0 C-50,20,-25,40,-10,40 C-5,35,5,35,10,40 C25,40,50,20,0,0',
        'M0 0 C50 25 50 75 0 100 C-50 75 -50 25 0 0',
      ];
      // const colorObj = {
      //   const colors = _.zipObject(topGenres, petalColors)
      //   colors.Other = '#fff2b4'
      //   return colors
      // }
      const colorScale = d3.scaleOrdinal()
      .domain(topGenres)
      .range(petalColors)
      .unknown('#FFF2B4')
  
      // `rated` → `path` (type of flower petal)
      // array to map to: `petalPaths`
      const ratedScale = d3.scaleOrdinal()
        .range(petalPaths)
  
      // `rating` → `scale` (size of petals)
      const minMaxRating = d3.extent(movies, movie => movie.rating);
      const ratingScale = d3.scaleLinear()
        .domain(minMaxRating)
        .range([0.2, 1])
  
      // `votes` → `numPetals` (number of petals)
      const minMaxVotes = d3.extent(movies, movie => movie.votes);
      const voteScale = d3.scaleQuantize()
        .domain(minMaxVotes)
        .range([5,6,7,8,9,10])
      return _.map(movies, (d, i) => {
        return {
          color: colorScale(d.genres[0]),
          path: ratedScale(d.rated),
          scale: ratingScale(d.rating),
          numPetals: voteScale(d.votes),
          title: d.title,
          rated: d.rated
        }
      })
    }

    const calculateGraph = (prevGraph, movies, flowers) => {
      const genres = {}
      const nodes = []
      const links = []
      
      _.each(movies, (d, i) => {
        let flower = prevGraph && _.find(prevGraph.nodes, ({title}) => title === d.title)
        flower = flower || flowers[i]
                            
        // insert flower into nodes
        nodes.push(flower)
        
        // loop through genres and link the movie flower to the genre
        _.each(d.genres, genre => {
          if (prevGraph) {
            genres[genre] = _.find(prevGraph.genres, ({label}) => label === genre)
          }
          if (!genres[genre]) {
            // if genre doesn't yet exist, create it
            genres[genre] = {
              label: genre,
              size: 0,
            }
          }
          genres[genre].size += 1
          
          // then create a new link
          links.push({
            source: genres[genre],
            target: flower,
            id: `${genre}-movie${i}`,
          })
        })
      })
      
      return {nodes, genres: _.values(genres), links}
    }

    const flowersData = calculateData();
    setGraph(calculateGraph(null, movies, flowersData))

    //create a resize event listener
    const resizeListener = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    };
    window.addEventListener('resize', resizeListener);

    return () => {
      window.removeEventListener('resize', resizeListener);
    }
  }, [])
  

  useEffect(() => {
    if (!graph) return;
    // ✨ OUR CODE HERE
    const link = d3.select('svg').selectAll('.link')
      .data(graph.links, d => d.id)
      .join('line')
      .classed('link', true)
      .attr('stroke', '#ccc')
      .attr('opacity', 0.5)

    const flowers = d3.select('svg').selectAll('g')
      .data(graph.nodes, d => d.title)
      .join(
        enter => {
          const g = enter.append('g')
        
          g.selectAll('path')
            .data(d => _.times(d.numPetals, i => ({...d, rotate: i * (360 / d.numPetals)})))
          .join('path')
          .attr('transform', d => `rotate(${d.rotate})scale(${d.scale})`)
          .attr('d', d => d.path)
          .attr('fill', d => d.color)
          .attr('stroke', d => d.color)
          .attr('fill-opacity', 0.5)
          .attr('stroke-width', 2)

          g.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '.35em')
            .style('font-size', '.5em')
            .style('font-style', 'italic')
            .text(d => _.truncate(d.title, 10))
          return g
        }
      )

    const genres = d3.select('svg').selectAll('.genre')
      .data(graph.genres, d => d.label)
      .join('text')
      .classed('genre', true)
      .text(d => d.label)
      .attr('text-anchor', 'middle')

    const nodes = _.union(graph.nodes, graph.genres)

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(graph.links))
      .force('collide', d3.forceCollide(d => d.scale * 75))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .on('tick', () => {
        flowers.attr('transform', d => `translate(${d.x}, ${d.y})`)
        genres.attr('transform', d => `translate(${d.x}, ${d.y})`)
        link.attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y)
      });
      setSimulationHandle(simulation);
  }, [graph, width, height])

  // useEffect(() => {
  //   if(!simulationHandle) return;
  //   simulationHandle.forceCenter(width / 2, height / 2)
  // }, [simulationHandle, width, height])

  return (
    <div className="App">
      <svg width={width} height={height}></svg>
    </div>
  );
}

export default App;
