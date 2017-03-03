class Universe {
	constructor(canvas) {
		this.canvas = canvas;
		this.starSystem = new StarSystem(canvas);
		this.players = [];
		this.particles = new Set();

		this.gameState = {
			currentPlayer: 0,
			state: Universe.TARGETTING
		};

		this.craterSize = 25;

		this.timestream = new Timestream();
		this.timestream.maxInterval = 100;
		this.timestream.on('frame', interval => {
			const ctx = this.canvas.getContext('2d');
			let ongoingShot = false;
			this.drawBackground(ctx);
			this.particles.forEach(particle => {
				if (interval == this.maxInterval &&
					particle.disposable)
					particle.destroy();
				if (particle.destroyed) {
					this.removeParticle(particle);
					return;
				}
				const motion = particle.advance(
						interval / 1000, this.starSystem);
				if (particle.checkCollisions) {
					const planetCollision = this.starSystem.collision(
							motion, particle.radius);
					if (planetCollision) {
						particle.impact(planetCollision);
						if (particle.destroysPlanet) {
							planetCollision.obstacle.addCrater(
								planetCollision.location,
								this.craterSize);
							// Bits of planet
							Explosions.single(this, planetCollision.location,
								{
									velocity: Vector.zero,
									violence: 400,
									destroyOnImpact: true,
									debrisCount: 250,
									lifetime: 100000,
									debrisRadius: 3,
									globalCompositeOperation: 'source-over',
									baseColour: `${planetCollision.obstacle.hue}, 75%, 20%`,
									colourModel: 'hsl',
									smooth: false
								});
						}
					}
					if (particle.isBullet) {
						ongoingShot = true;
						if (particle.hasClearedShooter)
							this.players.forEach(player => {
								const playerCollision =
									player.collision(motion, particle.radius);
								if (playerCollision) {
									player.explode();
									particle.impact(playerCollision);
									this.gameState.state = Universe.GAME_OVER;
								}
							});
						else if (particle.location.distanceTo(particle.owner.location) >
								particle.radius + particle.owner.hitArea.radius)
							particle.hasClearedShooter = true;
					}
				}
				particle.draw(ctx);
			});
			if (!ongoingShot &&
				this.gameState.state == Universe.ONGOING_SHOT)
				this.gameState.state = Universe.TARGETTING;
		});

		this._clickListener = e => {
			if (this.gameState.state != Universe.TARGETTING)
				return;
			const mouse = Vector.canvasMouseVector(this.canvas, e);
			this.currentPlayer.shoot(
				mouse.minus(this.currentPlayer.location)
					.times(1));
			this.endTurn();
		};
		canvas.addEventListener('click', this._clickListener);
	}

	addPlayer(location, size) {
		this.players.push(
			new Player(this, location, size));
	}

	addParticle(...args) {
		const p = new Particle(this, ...args);
		this.particles.add(p);
		return p;
	}

	removeParticle(particle) {
		this.particles.delete(particle);
	}

	drawBackground(ctx) {
		ctx.clearRect(-10, -10, this.canvas.width + 20, this.canvas.height + 20);
		this.starSystem.draw(ctx);
		this.players.forEach(player => player.draw(ctx));
	}

	gravityAt(location) {
		return this.starSystem.gravityAt(location);
	}

	get currentPlayer() {
		return this.players[this.gameState.currentPlayer];
	}

	endTurn() {
		this.gameState.currentPlayer =
			1 - this.gameState.currentPlayer;
		this.gameState.state = Universe.ONGOING_SHOT;
	}

	destroy() {
		this._cancelUpdates();
		this.canvas.removeEventListener(this._clickListener);
	}
}

Universe.TARGETTING = Symbol('Targetting');
Universe.ONGOING_SHOT = Symbol('Ongoing Shot');
Universe.GAME_OVER = Symbol('Game Over');
