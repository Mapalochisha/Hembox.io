"use client"

const steps = [
  {
    number: "01",
    title: "Discovery & Strategy",
    description: "We dive deep into your business goals, target audience, and competition to create a winning roadmap.",
  },
  {
    number: "02",
    title: "UI/UX Design",
    description: "Our designers craft intuitive, stunning interfaces that align perfectly with your brand identity.",
  },
  {
    number: "03",
    title: "Modern Build",
    description: "We bring designs to life using clean, efficient code that ensures lightning-fast performance.",
  },
  {
    number: "04",
    title: "Launch & Growth",
    description: "Your project goes live with full optimization, followed by ongoing support to ensure sustained success.",
  },
]

export function ProcessSection() {
  return (
    <section id="about" className="py-24 bg-navy text-white overflow-hidden">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-[13px] font-bold tracking-[0.2em] text-teal uppercase mb-3">Our Process</h2>
            <h3 className="text-[36px] sm:text-[48px] font-black tracking-tight leading-tight mb-6">
              How we bring your <br /> 
              <span className="text-teal">vision to life.</span>
            </h3>
            <p className="text-gray-400 text-[18px] leading-relaxed mb-8">
              We've refined our workflow over hundreds of projects to ensure a 
              smooth, transparent, and results-driven experience for every client.
            </p>
            <div className="flex flex-wrap gap-8">
              <div>
                <p className="text-[32px] font-black text-teal">100+</p>
                <p className="text-[14px] text-gray-400 uppercase tracking-wider font-bold">Projects Done</p>
              </div>
              <div>
                <p className="text-[32px] font-black text-coral">99%</p>
                <p className="text-[14px] text-gray-400 uppercase tracking-wider font-bold">Happy Clients</p>
              </div>
              <div>
                <p className="text-[32px] font-black text-white">24/7</p>
                <p className="text-[14px] text-gray-400 uppercase tracking-wider font-bold">Support</p>
              </div>
            </div>
          </div>

          <div className="space-y-12 relative">
            <div className="absolute left-[27px] top-4 bottom-4 w-[2px] bg-white/10 hidden sm:block" />
            
            {steps.map((step, index) => (
              <div key={index} className="relative pl-0 sm:pl-16 group">
                <div className="hidden sm:grid absolute left-0 top-0 w-14 h-14 rounded-2xl bg-white/5 border border-white/10 place-items-center z-10 group-hover:bg-teal group-hover:border-teal transition-all duration-300">
                  <span className="text-[18px] font-black group-hover:text-navy">{step.number}</span>
                </div>
                <h4 className="text-[22px] font-bold mb-2 flex items-center gap-4">
                  <span className="sm:hidden text-teal">{step.number}.</span>
                  {step.title}
                </h4>
                <p className="text-gray-400 leading-relaxed text-[16px]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
